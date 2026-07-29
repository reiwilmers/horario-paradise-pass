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

/** Dashboard schedule authority — local wins over cloud only during active edits. */
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
  isScheduleEditor = false,
  reference = new Date(),
} = {}) {
  if (!isScheduleEditor || !preserveRecentEdits) return false;
  if (!localHasScheduleAuthority(local)) return false;
  if (isStaleScheduleWeek(local?.schedules?.current, local?.forecasts?.current, reference)) {
    return false;
  }
  return isCurrentCalendarWeekSchedule(
    local?.schedules?.current,
    local?.forecasts?.current,
    reference,
  );
}

export function shouldPushLocalSchedules(local, {
  isScheduleEditor = false,
  reference = new Date(),
} = {}) {
  if (!isScheduleEditor) return false;
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

export function mergeOperationalRemote(remote, local, {
  preserveRecentEdits = false,
  isScheduleEditor = false,
  reference = new Date(),
} = {}) {
  if (!remote) return remote;
  const merged = { ...remote };

  if (shouldPreserveLocalSchedules(local, remote, {
    preserveRecentEdits,
    isScheduleEditor,
    reference,
  })) {
    for (const key of LOCAL_SCHEDULE_AUTHORITY_KEYS) {
      if (local?.[key] != null) merged[key] = local[key];
    }
  }

  if (preserveRecentEdits && isScheduleEditor) {
    for (const key of LOCAL_EDITABLE_OPERATIONAL_KEYS) {
      if (local?.[key] != null) merged[key] = local[key];
    }
  }

  if (!isScheduleEditor) {
    merged.visibleWeek = 'current';
  }

  return merged;
}

export function preserveLocalOperationalFields(
  remote,
  local,
  preserveLocalEditable = false,
  reference = new Date(),
  isScheduleEditor = false,
) {
  return mergeOperationalRemote(remote, local, {
    preserveRecentEdits: preserveLocalEditable,
    isScheduleEditor,
    reference,
  });
}
