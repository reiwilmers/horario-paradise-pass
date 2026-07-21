import * as db from './db.js';
import { mergeRequestsById } from '../domain/requests.js';
import { dedupeExceptionsByRequest } from '../domain/exceptions.js';
import {
  buildOperationalCloudState,
  shouldApplyRemoteOperational,
  countOperationalAssignments,
  OPERATIONAL_CLOUD_KEY,
} from '../domain/cloudSync.js';
import {
  getState,
  loadRequests,
  loadExceptions,
  hydrateFromDb,
} from './store.js';
import {
  persistAllRequests,
  persistAllExceptions,
  persistOperationalLocal,
} from './actions/persist.js';
import { showSuccess } from './utils/toast.js';

const SYNC_KEYS = new Set([
  'paradise-pass-requests',
  'paradise-pass-exceptions',
  OPERATIONAL_CLOUD_KEY,
]);
const TABLE = 'app_state';

/** @type {{ enabled: boolean, url: string, key: string }} */
let config = { enabled: false, url: '', key: '' };
let deviceId = '';
const writeTimers = new Map();
let pollTimer = null;
let lastPullAt = 0;
let lastPushError = '';

export async function loadCloudConfig() {
  try {
    const mod = await import('./config.js');
    config = {
      enabled: Boolean(mod.SUPABASE_ENABLED && mod.SUPABASE_URL && mod.SUPABASE_ANON_KEY),
      url: mod.SUPABASE_URL || '',
      key: mod.SUPABASE_ANON_KEY || '',
    };
  } catch {
    config = { enabled: false, url: '', key: '' };
  }
}

export function isCloudEnabled() {
  return config.enabled;
}

async function ensureDeviceId() {
  const existing = await db.getSetting('deviceId');
  if (existing?.value) {
    deviceId = existing.value;
    return deviceId;
  }
  deviceId = globalThis.crypto?.randomUUID?.() || `dev-${Date.now()}`;
  await db.setSetting('deviceId', deviceId);
  return deviceId;
}

function apiUrl(query = '') {
  return `${config.url.replace(/\/$/, '')}/rest/v1/${TABLE}${query}`;
}

async function supabaseFetch(pathQuery, options = {}) {
  if (!config.enabled) return null;
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    'Content-Type': 'application/json',
    Prefer: options.prefer || 'return=minimal',
    ...(options.headers || {}),
  };
  const response = await fetch(apiUrl(pathQuery), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function queueCloudSync(key, value) {
  if (!config.enabled || !SYNC_KEYS.has(key)) return;
  clearTimeout(writeTimers.get(key));
  writeTimers.set(key, setTimeout(() => {
    pushKey(key, value).catch(console.error);
  }, 400));
}

export function queueOperationalCloudSync(state = getState()) {
  const payload = buildOperationalCloudState(state);
  queueCloudSync(OPERATIONAL_CLOUD_KEY, payload);
}

async function upsertKey(key, value) {
  await ensureDeviceId();
  const body = {
    key,
    value,
    updated_by: deviceId,
    updated_at: new Date().toISOString(),
  };
  await supabaseFetch(`?on_conflict=key`, {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body,
  });
}

async function pushKey(key, value) {
  try {
    await upsertKey(key, value);
    lastPushError = '';
    if (key === OPERATIONAL_CLOUD_KEY && value?.updatedAt) {
      await db.setSetting('operationalCloudUpdatedAt', value.updatedAt);
    }
  } catch (error) {
    lastPushError = String(error?.message || error);
    console.error('Cloud push failed', key, error);
    throw error;
  }
}

async function fetchLatestValue(key) {
  const rows = await supabaseFetch(`?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at,updated_by&limit=1`);
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0]?.value ?? null;
}

async function applyOperationalRemote(remote) {
  if (!remote?.updatedAt) return false;
  const localSetting = await db.getSetting('operationalCloudUpdatedAt');
  const localUpdatedAt = localSetting?.value || null;
  const localCount = countOperationalAssignments(getState());
  const remoteCount = countOperationalAssignments(remote);
  const remoteIsRicher = remoteCount > localCount;
  const shouldApply = remoteIsRicher || shouldApplyRemoteOperational(localUpdatedAt, remote);
  if (!shouldApply) return false;

  hydrateFromDb({
    schedules: remote.schedules,
    forecasts: remote.forecasts,
    morningWbdMap: remote.morningWbdMap,
    visibleWeek: remote.visibleWeek,
    forecastSettings: remote.forecastSettings,
    forecastEditWeek: remote.forecastEditWeek,
    agents: remote.agents,
    salesTracking: remote.salesTracking,
    monthlyGoals: remote.monthlyGoals,
  });
  await persistOperationalLocal();
  await db.setSetting('operationalCloudUpdatedAt', remote.updatedAt);
  return true;
}

async function pushLocalIfRicher(remoteOperational) {
  const state = getState();
  const localCount = countOperationalAssignments(state);
  const remoteCount = countOperationalAssignments(remoteOperational);
  const localUpdatedAt = (await db.getSetting('operationalCloudUpdatedAt'))?.value || null;
  const remoteUpdatedAt = remoteOperational?.updatedAt || null;

  const localIsNewer = localUpdatedAt && remoteUpdatedAt
    && new Date(localUpdatedAt).getTime() > new Date(remoteUpdatedAt).getTime();
  const localHasMore = localCount > remoteCount;

  if (localIsNewer || localHasMore || !remoteUpdatedAt) {
    await pushOperationalCloudStateNow(state);
    return true;
  }
  return false;
}

async function seedMissingCloudKeys() {
  const state = getState();
  const remoteExceptions = await fetchLatestValue('paradise-pass-exceptions');
  if ((!Array.isArray(remoteExceptions) || !remoteExceptions.length) && state.exceptions?.length) {
    await upsertKey('paradise-pass-exceptions', state.exceptions);
  }
  const remoteRequests = await fetchLatestValue('paradise-pass-requests');
  if ((!Array.isArray(remoteRequests) || !remoteRequests.length) && state.requests?.length) {
    await upsertKey('paradise-pass-requests', state.requests);
  }
}

export async function pullCloudState({ notify = false } = {}) {
  if (!config.enabled) return false;
  await ensureDeviceId();

  const remoteRequests = await fetchLatestValue('paradise-pass-requests');
  const remoteExceptions = await fetchLatestValue('paradise-pass-exceptions');
  const remoteOperational = await fetchLatestValue(OPERATIONAL_CLOUD_KEY);

  let changed = false;

  if (Array.isArray(remoteRequests)) {
    const merged = mergeRequestsById(getState().requests, remoteRequests);
    if (JSON.stringify(merged) !== JSON.stringify(getState().requests)) {
      loadRequests(merged);
      await persistAllRequests();
      changed = true;
    }
  }

  if (Array.isArray(remoteExceptions)) {
    const merged = dedupeExceptionsByRequest(remoteExceptions);
    if (JSON.stringify(merged) !== JSON.stringify(getState().exceptions)) {
      loadExceptions(merged);
      await persistAllExceptions();
      changed = true;
    }
  }

  if (await applyOperationalRemote(remoteOperational)) {
    changed = true;
  }

  lastPullAt = Date.now();
  if (notify && changed) {
    showSuccess('Datos sincronizados desde la nube.');
  }
  return changed;
}

export async function pushOperationalCloudStateNow(state = getState()) {
  if (!config.enabled) return false;
  const payload = buildOperationalCloudState(state);
  await pushKey(OPERATIONAL_CLOUD_KEY, payload);
  return true;
}

export async function syncCloudNow({ notify = true } = {}) {
  if (!config.enabled) return false;
  await pullCloudState({ notify: false });
  const remoteOperational = await fetchLatestValue(OPERATIONAL_CLOUD_KEY);
  await pushLocalIfRicher(remoteOperational);
  await seedMissingCloudKeys();
  const changed = await pullCloudState({ notify: false });
  if (notify) {
    showSuccess(changed ? 'Datos sincronizados desde la nube.' : 'Datos enviados a la nube.');
  }
  return true;
}

export function startCloudPolling(intervalMs = 8000) {
  if (!config.enabled || pollTimer) return;
  pollTimer = setInterval(() => {
    pullCloudState().catch(console.error);
  }, intervalMs);
}

export function stopCloudPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

export async function initCloud() {
  await loadCloudConfig();
  if (!config.enabled) return;

  await pullCloudState();

  try {
    const remoteOperational = await fetchLatestValue(OPERATIONAL_CLOUD_KEY);
    await pushLocalIfRicher(remoteOperational);
    await seedMissingCloudKeys();
    await pullCloudState();
  } catch (error) {
    console.error('Cloud seed failed', error);
    lastPushError = String(error?.message || error);
  }

  startCloudPolling();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullCloudState().catch(console.error);
    }
  });
}

export function getCloudStatus() {
  return {
    enabled: config.enabled,
    lastPullAt,
    lastPushError,
  };
}

export { SYNC_KEYS, OPERATIONAL_CLOUD_KEY };
