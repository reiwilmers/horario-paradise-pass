import {
  isCurrentCalendarWeekSchedule,
  isStaleScheduleWeek,
  resolveScheduleMonday,
  scheduleHasAssignments,
  shouldApplyRemoteOperational,
} from './cloudSync.js';

/**
 * Decide whether this device should replace in-memory / IndexedDB operational state
 * with the remote cloud payload.
 */
export function shouldApplyRemoteOperationalState(local, remote, {
  localUpdatedAt = null,
  isScheduleEditor = false,
  preserveRecentEdits = false,
  reference = new Date(),
} = {}) {
  if (!remote?.updatedAt) return false;

  const remoteNewer = shouldApplyRemoteOperational(localUpdatedAt, remote);
  const localCurrent = local?.schedules?.current;
  const remoteCurrent = remote?.schedules?.current;
  const localEmpty = !scheduleHasAssignments(localCurrent);
  const remoteHasSchedule = scheduleHasAssignments(remoteCurrent);
  const localStale = isStaleScheduleWeek(localCurrent, local?.forecasts?.current, reference);
  const localMonday = resolveScheduleMonday(localCurrent, local?.forecasts?.current);
  const remoteMonday = resolveScheduleMonday(remoteCurrent, remote?.forecasts?.current);
  const remoteIsCurrentWeek = isCurrentCalendarWeekSchedule(
    remoteCurrent,
    remote?.forecasts?.current,
    reference,
  );

  if (localEmpty && remoteHasSchedule) return true;
  if (localStale && remoteIsCurrentWeek && remoteHasSchedule) return true;
  if (remoteMonday && localMonday && localMonday !== remoteMonday && remoteHasSchedule) return true;

  if (isScheduleEditor && preserveRecentEdits) {
    return remoteNewer;
  }

  if (!isScheduleEditor) {
    return remoteNewer;
  }

  return remoteNewer;
}
