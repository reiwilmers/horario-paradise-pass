import { DAYS } from './constants.js';
import { ASSIGNABLE_BLOCKS } from './blocks.js';
import { removeAgentFromDay, addAgentToBlock } from './schedule.js';
import { activeScheduleExceptions, exceptionTypeToBlock } from './exceptions.js';
import { forecastDateForDay } from './forecast.js';

function dateInRange(date, from, until) {
  const dateMs = new Date(`${date}T00:00:00`).getTime();
  const fromMs = new Date(`${from}T00:00:00`).getTime();
  const untilMs = new Date(`${until || from}T00:00:00`).getTime();
  return dateMs >= fromMs && dateMs <= untilMs;
}

export function applyExceptionsToScheduleDays(days, forecastRows = [], exceptions = []) {
  const next = structuredClone(days);
  const active = activeScheduleExceptions(exceptions);

  for (const day of DAYS) {
    const date = forecastDateForDay(forecastRows, day);
    if (!date) continue;
    for (const exception of active) {
      if (!dateInRange(date, exception.from, exception.until)) continue;
      const agentId = exception.agentId;
      if (!agentId) continue;
      next[day] = removeAgentFromDay(next[day], agentId);
      const block = exceptionTypeToBlock(exception.type);
      if (!block) continue;
      const added = addAgentToBlock(next[day], block, agentId);
      if (added) next[day] = added;
    }
  }

  return next;
}

export function applyExceptionsToWeeks(schedules, forecasts, exceptions) {
  return {
    current: applyExceptionsToScheduleDays(
      schedules.current?.days || {},
      forecasts.current || [],
      exceptions,
    ),
    next: applyExceptionsToScheduleDays(
      schedules.next?.days || {},
      forecasts.next || [],
      exceptions,
    ),
  };
}
