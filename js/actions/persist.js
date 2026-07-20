import * as db from '../db.js';
import { getState } from '../store.js';
import { queueCloudSync } from '../cloud.js';

export async function persistSchedule(weekKey) {
  const schedule = getState().schedules[weekKey];
  await db.put('schedules', schedule);
}

export async function persistMorningWbdMap() {
  await db.setSetting('morningWbdMap', getState().morningWbdMap);
}

export async function persistVisibleWeek() {
  await db.setSetting('visibleWeek', getState().visibleWeek);
}

export async function persistForecastEditWeek() {
  await db.setSetting('forecastEditWeek', getState().forecastEditWeek);
}

export async function persistCurrentUserId() {
  await db.setSetting('currentUserId', getState().ui.currentUserId);
}

export async function persistRequest(request) {
  await db.put('requests', request);
  queueCloudSync('paradise-pass-requests', getState().requests);
}

export async function persistAllRequests() {
  const requests = getState().requests;
  await db.putMany('requests', requests);
  queueCloudSync('paradise-pass-requests', requests);
}

export async function persistException(exception) {
  await db.put('exceptions', exception);
  queueCloudSync('paradise-pass-exceptions', getState().exceptions);
}

export async function persistAllExceptions() {
  const exceptions = getState().exceptions;
  await db.putMany('exceptions', exceptions);
  queueCloudSync('paradise-pass-exceptions', exceptions);
}

export async function persistSalesTracking() {
  await db.setSetting('salesTracking', getState().salesTracking);
}

export async function loadStateFromDb() {
  const agents = await db.getAll('agents');
  const current = await db.get('schedules', 'current');
  const next = await db.get('schedules', 'next');
  const forecastCurrent = await db.get('forecasts', 'current');
  const forecastNext = await db.get('forecasts', 'next');
  const morningWbd = await db.getSetting('morningWbdMap');
  const visibleWeek = await db.getSetting('visibleWeek');
  const forecastSettings = await db.getSetting('forecastSettings');
  const forecastEditWeek = await db.getSetting('forecastEditWeek');
  const currentUserId = await db.getSetting('currentUserId');
  const eveningWbdCounts = await db.getSetting('eveningWbdCounts');
  const requests = await db.getAll('requests');
  const exceptions = await db.getAll('exceptions');
  const salesTracking = await db.getSetting('salesTracking');
  return {
    agents,
    schedules: { current, next },
    forecasts: {
      current: forecastCurrent?.rows || [],
      next: forecastNext?.rows || [],
    },
    morningWbdMap: morningWbd?.value,
    visibleWeek: visibleWeek?.value,
    forecastSettings: forecastSettings?.value,
    forecastEditWeek: forecastEditWeek?.value,
    currentUserId: currentUserId?.value,
    eveningWbdCounts: eveningWbdCounts?.value,
    requests,
    exceptions,
    salesTracking: salesTracking?.value,
  };
}
