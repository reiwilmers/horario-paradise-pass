import { scheduleHasAssignments } from './cloudSync.js';

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

export function mergeOperationalRemote(remote, local, { preserveRecentEdits = false } = {}) {
  if (!remote) return remote;
  const merged = { ...remote };

  if (localHasScheduleAuthority(local)) {
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

export function preserveLocalOperationalFields(remote, local, preserveLocalEditable = false) {
  return mergeOperationalRemote(remote, local, { preserveRecentEdits: preserveLocalEditable });
}
