import { SEED_DATA } from './seed-data.js';

const DB_NAME = 'horarioParadisePassDB';
const DB_VERSION = 1;

/** @type {IDBDatabase | null} */
let db = null;

const STORES = ['agents', 'schedules', 'forecasts', 'settings', 'requests', 'exceptions', 'snapshots'];

export function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains('agents')) {
        database.createObjectStore('agents', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('schedules')) {
        database.createObjectStore('schedules', { keyPath: 'weekKey' });
      }
      if (!database.objectStoreNames.contains('forecasts')) {
        database.createObjectStore('forecasts', { keyPath: 'weekKey' });
      }
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('requests')) {
        const rs = database.createObjectStore('requests', { keyPath: 'id' });
        rs.createIndex('status', 'status', { unique: false });
      }
      if (!database.objectStoreNames.contains('exceptions')) {
        database.createObjectStore('exceptions', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('snapshots')) {
        database.createObjectStore('snapshots', { keyPath: 'id' });
      }
    };
  });
}

function tx(store, mode = 'readonly') {
  return openDB().then((database) => database.transaction(store, mode).objectStore(store));
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const s = await tx(store);
  return promisify(s.getAll());
}

export async function get(store, key) {
  const s = await tx(store);
  return promisify(s.get(key));
}

export async function put(store, item) {
  const s = await tx(store, 'readwrite');
  return promisify(s.put(item));
}

export async function putMany(store, items) {
  const database = await openDB();
  const transaction = database.transaction(store, 'readwrite');
  const objectStore = transaction.objectStore(store);
  await Promise.all(items.map((item) => promisify(objectStore.put(item))));
}

export async function getSetting(key) {
  return get('settings', key);
}

export async function setSetting(key, value) {
  return put('settings', { key, value, updatedAt: new Date().toISOString() });
}

export async function seedDefaults(force = false) {
  const existing = await getAll('agents');
  if (existing.length && !force) return false;

  await putMany('agents', SEED_DATA.agents);
  await put('schedules', SEED_DATA.schedules.current);
  await put('schedules', SEED_DATA.schedules.next);
  await put('forecasts', { weekKey: 'current', rows: SEED_DATA.forecasts.current });
  await put('forecasts', { weekKey: 'next', rows: SEED_DATA.forecasts.next });
  await setSetting('forecastSettings', SEED_DATA.forecastSettings);
  await setSetting('morningWbdMap', SEED_DATA.morningWbdMap);
  await setSetting('eveningWbdCounts', SEED_DATA.eveningWbdCounts);
  await setSetting('visibleWeek', SEED_DATA.visibleWeek);
  await setSetting('forecastEditWeek', SEED_DATA.forecastEditWeek);
  return true;
}

export { STORES };
