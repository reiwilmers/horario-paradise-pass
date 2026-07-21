/**
 * Operational cloud payload — schedules, agents, forecasts, WBD, etc.
 * Requests/exceptions sync on separate keys.
 */
export function countScheduleAssignments(schedule) {
  if (!schedule?.days) return 0;
  let count = 0;
  for (const dayPlan of Object.values(schedule.days)) {
    if (!dayPlan || typeof dayPlan !== 'object') continue;
    for (const agentIds of Object.values(dayPlan)) {
      if (Array.isArray(agentIds)) count += agentIds.length;
    }
  }
  return count;
}

export function countOperationalAssignments(source) {
  if (!source) return 0;
  const schedules = source.schedules || source;
  return countScheduleAssignments(schedules?.current) + countScheduleAssignments(schedules?.next);
}

export function scheduleHasAssignments(schedule) {
  return countScheduleAssignments(schedule) > 0;
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
    distributionSnapshots: state.distributionSnapshots,
  };
}

export function shouldApplyRemoteOperational(localUpdatedAt, remotePayload) {
  if (!remotePayload?.updatedAt) return false;
  if (!localUpdatedAt) return true;
  return new Date(remotePayload.updatedAt).getTime() > new Date(localUpdatedAt).getTime();
}

export const OPERATIONAL_CLOUD_KEY = 'paradise-pass-operational';
