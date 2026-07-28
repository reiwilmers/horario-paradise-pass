import {
  countScheduleAssignments,
  isCurrentCalendarWeekSchedule,
  isStaleScheduleWeek,
  resolveScheduleMonday,
  scheduleHasAssignments,
} from './cloudSync.js';
import { weekMondayIso } from './forecast.js';

/** Fields preserved only while the user is actively editing (short window). */
export const LOCAL_EDITABLE_OPERATIONAL_KEYS = [
  'salesTracking',
  'monthlyGoals',
  'forecasts',
  'forecastSettings',
  'agentSalesStats',
];

/** Dashboard schedule authority — local wins over cloud until empty. */
export const LOCAL_SCHEDULE_AUTHORITY_KEYS = [
  'schedules',
  'morningWbdMap',
];

export function localHasScheduleAuthority(local = {}) {
  return scheduleHasAssignments(local?.schedules?.current)
    || scheduleHasAssignments(local?.schedules?.next);
}

export function shouldPreserveLocalSchedules(local, remote, {
  preserveRecentEdits = false,
  reference = new Date(),
} = {}) {
  if (!localHasScheduleAuthority(local)) return false;
  if (preserveRecentEdits) return true;

  const localCurrent = local?.schedules?.current;
  const remoteCurrent = remote?.schedules?.current;
  const localMonday = resolveScheduleMonday(localCurrent, local?.forecasts?.current);
  const remoteMonday = resolveScheduleMonday(remoteCurrent, remote?.forecasts?.current);
  const calendarMonday = weekMondayIso('current', reference);

  if (isStaleScheduleWeek(localCurrent, local?.forecasts?.current, reference)) return false;
  if (
    isCurrentCalendarWeekSchedule(remoteCurrent, remote?.forecasts?.current, reference)
    && localMonday
    && localMonday !== calendarMonday
  ) {
    return false;
  }

  if (localMonday && remoteMonday && localMonday === remoteMonday) {
    return countScheduleAssignments(localCurrent) >= countScheduleAssignments(remoteCurrent);
  }

  return isCurrentCalendarWeekSchedule(localCurrent, local?.forecasts?.current, reference);
}

export function shouldPushLocalSchedules(local, reference = new Date()) {
  if (!localHasScheduleAuthority(local)) return false;
  if (isStaleScheduleWeek(local?.schedules?.current, local?.forecasts?.current, reference)) {
    return false;
  }
  return isCurrentCalendarWeekSchedule(
    local?.schedules?.current,
    local?.forecasts?.current,
    reference,
  ) || !resolveScheduleMonday(local?.schedules?.current, local?.forecasts?.current);
}

export function mergeOperationalRemote(remote, local, { preserveRecentEdits = false, reference = new Date() } = {}) {
  if (!remote) return remote;
  const merged = { ...remote };

  if (shouldPreserveLocalSchedules(local, remote, { preserveRecentEdits, reference })) {
    for (const key of LOCAL_SCHEDULE_AUTHORITY_KEYS) {
      if (local?.[key] != null) merged[key] = local[key];
    }
  }

  if (preserveRecentEdits) {
    for (const key of LOCAL_EDITABLE_OPERATIONAL_KEYS) {
      if (local?.[key] != null) merged[key] = local[key];
    }
  }

  return merged;
}

export function preserveLocalOperationalFields(remote, local, preserveLocalEditable = false, reference = new Date()) {
  return mergeOperationalRemote(remote, local, {
    preserveRecentEdits: preserveLocalEditable,
    reference,
  });
}
