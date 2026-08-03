import * as db from '../db.js';
import { getState, patchMorningWbdMap } from '../store.js';
import { queueCloudSync, queueOperationalCloudSync, markLocalOperationalEdited, canWriteOperationalCloud } from '../cloud.js';
import { captureDistributionSnapshotForWeek } from './distributionSnapshots.js';
import { pruneMorningWbdMapGlobal } from '../../domain/morningWbd.js';

import { weekMondayIso } from '../../domain/forecast.js';
import { patchScheduleDays } from '../store.js';

async function touchOperationalEdit() {
  if (!canWriteOperationalCloud()) return;
  markLocalOperationalEdited();
}

function pruneGhostMorningWbd() {
  const state = getState();
  const pruned = pruneMorningWbdMapGlobal(state.morningWbdMap, state.schedules);
  if (JSON.stringify(pruned) !== JSON.stringify(state.morningWbdMap)) {
    patchMorningWbdMap(pruned);
    return true;
  }
  return false;
}

export async function persistSchedule(weekKey) {
  const key = weekKey === 'next' ? 'next' : 'current';
  const schedule = getState().schedules[key];
  const mondayIso = weekMondayIso(key);
  if (schedule?.mondayIso !== mondayIso) {
    patchScheduleDays(key, schedule.days, { mondayIso, weekKey: key });
  }
  const wbdChanged = pruneGhostMorningWbd();
  if (wbdChanged) {
    await db.setSetting('morningWbdMap', getState().morningWbdMap);
  }
  await db.put('schedules', getState().schedules[key]);
  await captureDistributionSnapshotForWeek(weekKey, { persist: false });
  await persistDistributionSnapshots();
  touchOperationalEdit();
  queueOperationalCloudSync();
}

export async function persistAllSchedules() {
  const state = getState();
  await db.put('schedules', state.schedules.current);
  await db.put('schedules', state.schedules.next);
  queueOperationalCloudSync();
}

export async function persistForecasts() {
  const state = getState();
  await db.put('forecasts', { weekKey: 'current', rows: state.forecasts.current || [] });
  await db.put('forecasts', { weekKey: 'next', rows: state.forecasts.next || [] });
  touchOperationalEdit();
  queueOperationalCloudSync();
}

export async function persistAllAgents() {
  const agents = getState().agents.ids.map((id) => getState().agents.byId[id]).filter(Boolean);
  await db.putMany('agents', agents);
  queueOperationalCloudSync();
}

export async function persistOperationalLocal() {
  const state = getState();
  await db.put('schedules', state.schedules.current);
  await db.put('schedules', state.schedules.next);
  await db.put('forecasts', { weekKey: 'current', rows: state.forecasts.current || [] });
  await db.put('forecasts', { weekKey: 'next', rows: state.forecasts.next || [] });
  await db.setSetting('morningWbdMap', state.morningWbdMap);
  await db.setSetting('visibleWeek', state.visibleWeek);
  await db.setSetting('forecastSettings', state.forecastSettings);
  await db.setSetting('forecastEditWeek', state.forecastEditWeek);
  await db.setSetting('salesTracking', state.salesTracking);
  await db.setSetting('monthlyGoals', state.monthlyGoals);
  await db.setSetting('distributionSnapshots', state.distributionSnapshots);
  await db.setSetting('scheduleLearning', state.scheduleLearning);
  await db.setSetting('agentSalesStats', state.agentSalesStats);
  const agents = state.agents.ids.map((id) => state.agents.byId[id]).filter(Boolean);
  await db.putMany('agents', agents);
}

export async function persistMorningWbdMap() {
  await db.setSetting('morningWbdMap', getState().morningWbdMap);
  const { captureLiveDistributionSnapshots } = await import('./distributionSnapshots.js');
  await captureLiveDistributionSnapshots();
  touchOperationalEdit();
  queueOperationalCloudSync();
}

export async function persistVisibleWeek() {
  await db.setSetting('visibleWeek', getState().visibleWeek);
  queueOperationalCloudSync();
}

export async function persistForecastEditWeek() {
  await db.setSetting('forecastEditWeek', getState().forecastEditWeek);
  queueOperationalCloudSync();
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
  touchOperationalEdit();
  queueOperationalCloudSync();
}

export async function persistMonthlyGoals() {
  await db.setSetting('monthlyGoals', getState().monthlyGoals);
  touchOperationalEdit();
  queueOperationalCloudSync();
}

export async function persistDistributionSnapshots() {
  await db.setSetting('distributionSnapshots', getState().distributionSnapshots);
  queueOperationalCloudSync();
}

export async function persistScheduleLearning() {
  await db.setSetting('scheduleLearning', getState().scheduleLearning);
  touchOperationalEdit();
  queueOperationalCloudSync();
}

export async function persistAgentSalesStats() {
  await db.setSetting('agentSalesStats', getState().agentSalesStats);
  touchOperationalEdit();
  queueOperationalCloudSync();
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
  const monthlyGoals = await db.getSetting('monthlyGoals');
  const distributionSnapshots = await db.getSetting('distributionSnapshots');
  const scheduleLearning = await db.getSetting('scheduleLearning');
  const agentSalesStats = await db.getSetting('agentSalesStats');
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
    monthlyGoals: monthlyGoals?.value,
    distributionSnapshots: distributionSnapshots?.value,
    scheduleLearning: scheduleLearning?.value,
    agentSalesStats: agentSalesStats?.value,
  };
}
