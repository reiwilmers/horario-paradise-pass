/**
 * Operational cloud payload — schedules, agents, forecasts, WBD, etc.
 * Requests/exceptions sync on separate keys.
 */
import { weekMondayIso } from './forecast.js';

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

export function shouldApplyRemoteOperational(localUpdatedAt, remotePayload) {
  if (!remotePayload?.updatedAt) return false;
  if (!localUpdatedAt) return true;
  return new Date(remotePayload.updatedAt).getTime() > new Date(localUpdatedAt).getTime();
}

export function resolveScheduleMonday(schedule, forecastRows = []) {
  if (schedule?.mondayIso) return schedule.mondayIso;
  return forecastRows?.[0]?.date || '';
}

export function isCurrentCalendarWeekSchedule(schedule, forecastRows = [], reference = new Date()) {
  const monday = resolveScheduleMonday(schedule, forecastRows);
  const calendarMonday = weekMondayIso('current', reference);
  return Boolean(monday && calendarMonday && monday === calendarMonday);
}

export function isStaleScheduleWeek(schedule, forecastRows = [], reference = new Date()) {
  const monday = resolveScheduleMonday(schedule, forecastRows);
  const calendarMonday = weekMondayIso('current', reference);
  if (!monday || !calendarMonday) return false;
  return monday < calendarMonday;
}

export function normalizeOperationalSchedules(schedules, forecasts, reference = new Date()) {
  if (!schedules) return schedules;
  return {
    current: {
      ...schedules.current,
      mondayIso: resolveScheduleMonday(schedules.current, forecasts?.current)
        || weekMondayIso('current', reference),
    },
    next: {
      ...schedules.next,
      mondayIso: resolveScheduleMonday(schedules.next, forecasts?.next)
        || weekMondayIso('next', reference),
    },
  };
}

export function buildOperationalCloudState(state, updatedAt = new Date().toISOString(), reference = new Date()) {
  const schedules = normalizeOperationalSchedules(state.schedules, state.forecasts, reference);
  return {
    updatedAt,
    schedules,
    forecasts: state.forecasts,
    morningWbdMap: state.morningWbdMap,
    visibleWeek: state.visibleWeek,
    forecastSettings: state.forecastSettings,
    forecastEditWeek: state.forecastEditWeek,
    agents: (state.agents?.ids || []).map((id) => state.agents.byId[id]).filter(Boolean),
    salesTracking: state.salesTracking,
    monthlyGoals: state.monthlyGoals,
    distributionSnapshots: state.distributionSnapshots,
    scheduleLearning: state.scheduleLearning,
    agentSalesStats: state.agentSalesStats,
  };
}

export const OPERATIONAL_CLOUD_KEY = 'paradise-pass-operational';
