import * as db from './db.js';
import { mergeRequestsById } from '../domain/requests.js';
import { dedupeExceptionsByRequest } from '../domain/exceptions.js';
import {
  preserveLocalOperationalFields,
  shouldPushLocalSchedules,
  shouldPreserveLocalSchedules,
} from '../domain/operationalMerge.js';
import { shouldApplyRemoteOperationalState } from '../domain/operationalSync.js';
import { verifyOperationalPayload } from '../domain/operationalVerify.js';
import { isSchedulePublisher } from '../domain/schedulePublisher.js';
import {
  buildOperationalCloudState,
  countOperationalAssignments,
  OPERATIONAL_CLOUD_KEY,
} from '../domain/cloudSync.js';
import {
  getState,
  loadRequests,
  loadExceptions,
  hydrateFromDb,
  currentUser,
} from './store.js';
import {
  persistAllRequests,
  persistAllExceptions,
  persistOperationalLocal,
} from './actions/persist.js';
import { showSuccess, showError } from './utils/toast.js';
import { fetchWithRetry } from './utils/fetchRetry.js';

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
let lastPullAt = 0;
let lastPushError = '';
let lastVerifiedSyncAt = '';
let operationalDirty = false;

export function canWriteOperationalCloud() {
  return isSchedulePublisher(currentUser());
}

export function hasOperationalDirty() {
  return operationalDirty;
}

export function markLocalOperationalEdited() {
  operationalDirty = true;
  db.setSetting('operationalDirty', true).catch(console.error);
}

export async function clearOperationalDirty() {
  operationalDirty = false;
  await db.setSetting('operationalDirty', false);
}

async function loadOperationalDirtyFlag() {
  const setting = await db.getSetting('operationalDirty');
  operationalDirty = Boolean(setting?.value);
}

function logSync(event, detail = {}) {
  const user = currentUser();
  console.info('[sync]', {
    at: new Date().toISOString(),
    event,
    userId: user?.id || null,
    role: isSchedulePublisher(user) ? 'publisher' : 'readonly',
    dirty: operationalDirty,
    ...detail,
  });
}

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

/** @internal Vitest-only helper — config.js is generated after `npm test` on Vercel. */
export function configureCloudForTests(options = {}) {
  if (!import.meta.env?.VITEST) return;
  config = {
    enabled: options.enabled ?? true,
    url: options.url ?? 'https://example.supabase.co',
    key: options.key ?? 'test-key',
  };
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
  const response = await fetchWithRetry(apiUrl(pathQuery), {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
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
  if (key === OPERATIONAL_CLOUD_KEY && !canWriteOperationalCloud()) return;
  clearTimeout(writeTimers.get(key));
  writeTimers.set(key, setTimeout(() => {
    pushKey(key, value).catch((error) => {
      logSync('queue_push_failed', { key, message: String(error?.message || error) });
    });
  }, 400));
}

export function queueOperationalCloudSync(state = getState()) {
  if (!canWriteOperationalCloud()) return;
  if (countOperationalAssignments(state) <= 0) return;
  markLocalOperationalEdited();
  const payload = buildOperationalCloudState(state, new Date().toISOString(), new Date(), currentUser()?.id || null);
  queueCloudSync(OPERATIONAL_CLOUD_KEY, payload);
}

export async function flushPendingCloudWrites() {
  for (const timer of writeTimers.values()) {
    clearTimeout(timer);
  }
  writeTimers.clear();
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
    prefer: 'resolution=merge-duplicates,return=representation',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body,
  });
}

async function pushKey(key, value) {
  if (key === OPERATIONAL_CLOUD_KEY && !canWriteOperationalCloud()) {
    logSync('push_rejected', { key, reason: 'forbidden', userId: currentUser()?.id || null });
    return false;
  }
  try {
    await upsertKey(key, value);
    lastPushError = '';
    if (key === OPERATIONAL_CLOUD_KEY && value?.updatedAt) {
      await db.setSetting('operationalCloudUpdatedAt', value.updatedAt);
    }
    return true;
  } catch (error) {
    lastPushError = String(error?.message || error);
    logSync('push_failed', { key, message: lastPushError });
    throw error;
  }
}

async function fetchLatestValue(key) {
  const rows = await supabaseFetch(
    `?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at,updated_by&limit=1`,
  );
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0]?.value ?? null;
}

export function fetchRemoteOperational() {
  return fetchLatestValue(OPERATIONAL_CLOUD_KEY);
}

function buildOperationalHydration(remotePayload) {
  return {
    schedules: remotePayload.schedules,
    forecasts: remotePayload.forecasts,
    morningWbdMap: remotePayload.morningWbdMap,
    visibleWeek: remotePayload.visibleWeek,
    forecastSettings: remotePayload.forecastSettings,
    forecastEditWeek: remotePayload.forecastEditWeek,
    agents: remotePayload.agents,
    salesTracking: remotePayload.salesTracking,
    monthlyGoals: remotePayload.monthlyGoals,
    distributionSnapshots: remotePayload.distributionSnapshots,
    scheduleLearning: remotePayload.scheduleLearning,
    agentSalesStats: remotePayload.agentSalesStats,
  };
}

function isPublisherSession() {
  return canWriteOperationalCloud();
}

async function applyOperationalRemote(remote, { reference = new Date() } = {}) {
  if (!remote?.updatedAt) return false;

  const localSetting = await db.getSetting('operationalCloudUpdatedAt');
  const localUpdatedAt = localSetting?.value || null;
  const localState = getState();
  const preserveRecent = hasOperationalDirty();
  const isPublisher = isPublisherSession();

  if (isPublisher && preserveRecent) {
    logSync('pull_skipped_dirty_local', {
      localUpdatedAt,
      remoteUpdatedAt: remote.updatedAt,
    });
    return false;
  }

  const shouldApply = shouldApplyRemoteOperationalState(localState, remote, {
    localUpdatedAt,
    isScheduleEditor: isPublisher,
    preserveRecentEdits: preserveRecent,
    reference,
  });

  if (!shouldApply) {
    return false;
  }

  const remotePayload = preserveLocalOperationalFields(
    remote,
    localState,
    preserveRecent,
    reference,
    isPublisher,
  );

  const hydrationErrors = hydrateFromDb(buildOperationalHydration(remotePayload));
  if (hydrationErrors.length) {
    logSync('hydrate_warnings', { count: hydrationErrors.length, errors: hydrationErrors });
  }

  await persistOperationalLocal();
  await db.setSetting('operationalCloudUpdatedAt', remote.updatedAt);
  logSync('pull_applied', { remoteUpdatedAt: remote.updatedAt });
  return true;
}

export async function pushLocalIfRicher(remoteOperational, { reference = new Date() } = {}) {
  const state = getState();
  const isPublisher = isPublisherSession();
  if (!isPublisher) return false;
  if (!hasOperationalDirty()) return false;

  if (!shouldPushLocalSchedules(state, { isScheduleEditor: true, reference })) {
    return false;
  }

  const payload = await pushOperationalCloudStateNow(state, { reference, publisherId: currentUser()?.id || null });
  if (payload) {
    await clearOperationalDirty();
    return true;
  }
  return false;
}

async function seedMissingCloudKeys() {
  if (!canWriteOperationalCloud()) return;
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

export async function pullCloudState({
  notify = false,
  reference = new Date(),
  syncPipeline = true,
} = {}) {
  const emptyResult = {
    changed: false,
    requestsChanged: false,
    exceptionsChanged: false,
    operationalChanged: false,
  };
  if (!config.enabled) return emptyResult;
  await ensureDeviceId();

  const remoteRequests = await fetchLatestValue('paradise-pass-requests');
  const remoteExceptions = await fetchLatestValue('paradise-pass-exceptions');
  const remoteOperational = await fetchLatestValue(OPERATIONAL_CLOUD_KEY);

  let requestsChanged = false;
  let exceptionsChanged = false;
  let operationalChanged = false;

  if (Array.isArray(remoteRequests)) {
    const merged = mergeRequestsById(getState().requests, remoteRequests);
    if (JSON.stringify(merged) !== JSON.stringify(getState().requests)) {
      loadRequests(merged);
      await persistAllRequests();
      requestsChanged = true;
    }
  }

  if (Array.isArray(remoteExceptions)) {
    const merged = dedupeExceptionsByRequest(remoteExceptions);
    if (JSON.stringify(merged) !== JSON.stringify(getState().exceptions)) {
      loadExceptions(merged);
      await persistAllExceptions();
      exceptionsChanged = true;
    }
  }

  if (await applyOperationalRemote(remoteOperational, { reference })) {
    operationalChanged = true;
  }

  lastPullAt = Date.now();
  const changed = requestsChanged || exceptionsChanged || operationalChanged;
  if (changed && syncPipeline && (requestsChanged || exceptionsChanged)) {
    const { syncApprovedPipeline } = await import('./actions/approved.js');
    await syncApprovedPipeline();
  }
  if (notify && changed) {
    showSuccess('Datos sincronizados desde la nube.');
  }
  return {
    changed,
    requestsChanged,
    exceptionsChanged,
    operationalChanged,
  };
}

export async function pushOperationalCloudStateNow(
  state = getState(),
  { reference = new Date(), publisherId = currentUser()?.id || null, payload = null } = {},
) {
  if (!config.enabled) return false;
  if (!isSchedulePublisher(currentUser())) {
    logSync('push_rejected', { reason: 'forbidden', userId: currentUser()?.id || null });
    return false;
  }
  const built = payload || buildOperationalCloudState(state, new Date().toISOString(), reference, publisherId);
  await pushKey(OPERATIONAL_CLOUD_KEY, built);
  return built;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchRemoteOperationalAfterWrite(localPayload, { attempts = 3, delayMs = 350 } = {}) {
  let remote = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await sleep(delayMs);
    remote = await fetchRemoteOperational();
    if (!remote?.updatedAt) continue;
    const verification = verifyOperationalPayload(localPayload, remote);
    if (verification.ok) return remote;
    if (verification.code !== 'SCHEDULE_MISMATCH' && verification.code !== 'ASSIGNMENT_COUNT') {
      return remote;
    }
  }
  return remote;
}

export async function syncCloudNow({ notify = true } = {}) {
  if (!config.enabled) {
    if (notify) showError('Sincronización con la nube desactivada.');
    return { ok: false, code: 'DISABLED' };
  }
  if (!canWriteOperationalCloud()) {
    logSync('manual_sync_rejected', { userId: currentUser()?.id || null });
    if (notify) showError('Solo Rei puede sincronizar horarios.');
    return { ok: false, code: 'FORBIDDEN' };
  }

  await flushPendingCloudWrites();

  const reference = new Date();
  const localPayload = buildOperationalCloudState(
    getState(),
    new Date().toISOString(),
    reference,
    currentUser().id,
  );

  logSync('manual_sync_start', {
    publisherId: currentUser().id,
    assignmentCount: countOperationalAssignments(localPayload),
    nextWeekMonday: localPayload.schedules?.next?.mondayIso || null,
    currentWeekMonday: localPayload.schedules?.current?.mondayIso || null,
  });

  try {
    await pushOperationalCloudStateNow(getState(), {
      reference,
      publisherId: currentUser().id,
      payload: localPayload,
    });
    const remote = await fetchRemoteOperationalAfterWrite(localPayload);
    const verification = verifyOperationalPayload(localPayload, remote);
    if (!verification.ok) {
      logSync('manual_sync_verify_failed', verification);
      if (notify) showError(`Sync falló: ${verification.message}`);
      return { ok: false, code: verification.code || 'VERIFY_FAILED', ...verification };
    }

    await persistOperationalLocal();
    await db.setSetting('operationalCloudUpdatedAt', remote.updatedAt);
    await clearOperationalDirty();
    lastVerifiedSyncAt = remote.updatedAt;
    lastPullAt = Date.now();

    logSync('manual_sync_success', {
      updatedAt: remote.updatedAt,
      assignmentCount: countOperationalAssignments(remote),
    });

    if (notify) showSuccess('Horario sincronizado y verificado.');
    return { ok: true, updatedAt: remote.updatedAt };
  } catch (error) {
    const message = String(error?.message || error);
    logSync('manual_sync_error', { message });
    if (notify) showError(`Error al sincronizar: ${message}`);
    return { ok: false, code: 'NETWORK', message };
  }
}

export async function initCloud() {
  await loadCloudConfig();
  if (!config.enabled) return;
  await loadOperationalDirtyFlag();
}

export function getCloudStatus() {
  return {
    enabled: config.enabled,
    lastPullAt,
    lastPushError,
    lastVerifiedSyncAt,
    operationalDirty,
    canWrite: canWriteOperationalCloud(),
  };
}

export { SYNC_KEYS, OPERATIONAL_CLOUD_KEY };
