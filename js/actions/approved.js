import {
  syncExceptionsFromRequests,
  parseException,
  isRequestApproved,
} from '../../domain/requests.js';
import { dedupeExceptionsByRequest } from '../../domain/exceptions.js';
import { applyExceptionsToWeeks } from '../../domain/scheduleExceptions.js';
import {
  getState,
  setExceptions,
  patchScheduleDays,
} from '../store.js';
import { persistAllExceptions, persistSchedule } from './persist.js';

export async function syncApprovedPipeline() {
  const state = getState();
  const merged = dedupeExceptionsByRequest(
    syncExceptionsFromRequests(state.requests, state.exceptions),
  );
  setExceptions(merged);
  await persistAllExceptions();

  const daysByWeek = applyExceptionsToWeeks(
    state.schedules,
    state.forecasts,
    merged,
  );

  patchScheduleDays('current', daysByWeek.current);
  patchScheduleDays('next', daysByWeek.next);
  await persistSchedule('current');
  await persistSchedule('next');

  return merged;
}

export function approvedRequestCount() {
  return getState().requests.filter((request) => isRequestApproved(request)).length;
}

export function buildManualException(raw) {
  return parseException(raw);
}
