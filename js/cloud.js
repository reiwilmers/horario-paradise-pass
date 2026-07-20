import * as db from './db.js';
import { mergeRequestsById } from '../domain/requests.js';
import { dedupeExceptionsByRequest } from '../domain/exceptions.js';
import {
  getState,
  loadRequests,
  loadExceptions,
} from './store.js';
import { persistAllRequests, persistAllExceptions } from './actions/persist.js';

const SYNC_KEYS = new Set(['paradise-pass-requests', 'paradise-pass-exceptions']);
const TABLE = 'app_state';

/** @type {{ enabled: boolean, url: string, key: string }} */
let config = { enabled: false, url: '', key: '' };
let deviceId = '';
const writeTimers = new Map();
let pollTimer = null;

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
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
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

async function pushKey(key, value) {
  await ensureDeviceId();
  await supabaseFetch(`?key=eq.${encodeURIComponent(key)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: {
      value,
      updated_by: deviceId,
      updated_at: new Date().toISOString(),
    },
  }).catch(async () => {
    await supabaseFetch('', {
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        key,
        value,
        updated_by: deviceId,
        updated_at: new Date().toISOString(),
      },
    });
  });
}

async function fetchLatestValue(key) {
  const rows = await supabaseFetch(`?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at,updated_by&limit=1`);
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0]?.value ?? null;
}

export async function pullCloudState() {
  if (!config.enabled) return false;
  await ensureDeviceId();

  const remoteRequests = await fetchLatestValue('paradise-pass-requests');
  const remoteExceptions = await fetchLatestValue('paradise-pass-exceptions');

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

  return changed;
}

export function startCloudPolling(intervalMs = 8000) {
  if (!config.enabled || pollTimer) return;
  pollTimer = setInterval(() => {
    pullCloudState().catch(console.error);
  }, intervalMs);
}

export async function initCloud() {
  await loadCloudConfig();
  if (!config.enabled) return;
  await pullCloudState();
  startCloudPolling();
}

export { SYNC_KEYS };
