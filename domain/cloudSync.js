/**
 * Operational cloud payload — schedules, agents, forecasts, WBD, etc.
 * Requests/exceptions sync on separate keys.
 */
export function scheduleHasAssignments(schedule) {
  if (!schedule?.days) return false;
  for (const dayPlan of Object.values(schedule.days)) {
    if (!dayPlan || typeof dayPlan !== 'object') continue;
    for (const agentIds of Object.values(dayPlan)) {
      if (Array.isArray(agentIds) && agentIds.length) return true;
    }
  }
  return false;
}

export function stateHasOperationalData(state) {
  if (!state) return false;
  if (scheduleHasAssignments(state.schedules?.current)) return true;
  if (scheduleHasAssignments(state.schedules?.next)) return true;
  if (Array.isArray(state.requests) && state.requests.length) return true;
  if (Array.isArray(state.exceptions) && state.exceptions.length) return true;
  if (state.salesTracking && Object.keys(state.salesTracking).length) return true;
  if (Array.isArray(state.monthlyGoals) && state.monthlyGoals.length) return true;
  return false;
}

export function buildOperationalCloudState(state, updatedAt = new Date().toISOString()) {
  return {
    updatedAt,
    schedules: state.schedules,
    forecasts: state.forecasts,
    morningWbdMap: state.morningWbdMap,
    visibleWeek: state.visibleWeek,
    forecastSettings: state.forecastSettings,
    forecastEditWeek: state.forecastEditWeek,
    agents: (state.agents?.ids || []).map((id) => state.agents.byId[id]).filter(Boolean),
    salesTracking: state.salesTracking,
    monthlyGoals: state.monthlyGoals,
  };
}

export function shouldApplyRemoteOperational(localUpdatedAt, remotePayload, localHasData = false) {
  if (!remotePayload?.updatedAt) return false;
  if (!localUpdatedAt) return !localHasData;
  return new Date(remotePayload.updatedAt).getTime() > new Date(localUpdatedAt).getTime();
}

export const OPERATIONAL_CLOUD_KEY = 'paradise-pass-operational';
