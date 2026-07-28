import { emptyWeekDays } from './schedule.js';
import {
  buildForecastRows,
  forecastMatchesCalendar,
  weekMondayIso,
} from './forecast.js';
import { scheduleHasAssignments } from './cloudSync.js';

function weekMondayFromState(forecasts = [], schedule = {}) {
  return forecasts?.[0]?.date || schedule?.mondayIso || '';
}

function buildEmptySchedule(weekKey, mondayIso) {
  return {
    weekKey,
    mondayIso,
    days: emptyWeekDays(),
    updatedAt: new Date().toISOString(),
  };
}

function promoteSchedule(schedule, weekKey, mondayIso) {
  return {
    ...schedule,
    weekKey,
    mondayIso,
    days: structuredClone(schedule?.days || emptyWeekDays()),
    updatedAt: new Date().toISOString(),
  };
}

function realignForecast(weekKey, rows = [], reference = new Date()) {
  return buildForecastRows(weekKey, reference, rows);
}

export function needsWeekRollover(state, reference = new Date()) {
  if (forecastMatchesCalendar(state.forecasts?.current, 'current', reference)
    && forecastMatchesCalendar(state.forecasts?.next, 'next', reference)) {
    return false;
  }

  const calendarCurrentMonday = weekMondayIso('current', reference);
  const currentMonday = weekMondayFromState(state.forecasts?.current, state.schedules?.current);
  if (!currentMonday) return true;
  return currentMonday < calendarCurrentMonday;
}

export function applyWeekRollover(state, reference = new Date()) {
  const calendarCurrentMonday = weekMondayIso('current', reference);
  const calendarNextMonday = weekMondayIso('next', reference);
  const currentMonday = weekMondayFromState(state.forecasts?.current, state.schedules?.current);
  const nextMonday = weekMondayFromState(state.forecasts?.next, state.schedules?.next);

  const currentHasSchedule = scheduleHasAssignments(state.schedules?.current);
  const nextHasSchedule = scheduleHasAssignments(state.schedules?.next);
  const nextMatchesCurrentCalendar = nextMonday === calendarCurrentMonday
    || forecastMatchesCalendar(state.forecasts?.next, 'current', reference);

  let rotated = false;
  let schedules = structuredClone(state.schedules);
  let forecasts = structuredClone(state.forecasts);

  if (!needsWeekRollover(state, reference)) {
    const nextForecasts = {
      current: realignForecast('current', forecasts.current, reference),
      next: realignForecast('next', forecasts.next, reference),
    };
    const nextSchedules = {
      current: promoteSchedule(schedules.current, 'current', calendarCurrentMonday),
      next: promoteSchedule(schedules.next, 'next', calendarNextMonday),
    };
    const changed = JSON.stringify(nextForecasts) !== JSON.stringify(forecasts)
      || nextSchedules.current.mondayIso !== schedules.current?.mondayIso
      || nextSchedules.next.mondayIso !== schedules.next?.mondayIso;
    return { changed, rotated: false, schedules: nextSchedules, forecasts: nextForecasts };
  }

  if (currentHasSchedule && !nextHasSchedule && currentMonday < calendarCurrentMonday) {
    forecasts = {
      current: realignForecast('current', forecasts.current, reference),
      next: realignForecast('next', forecasts.next, reference),
    };
    schedules = {
      current: promoteSchedule(schedules.current, 'current', calendarCurrentMonday),
      next: buildEmptySchedule('next', calendarNextMonday),
    };
    return { changed: true, rotated: false, realigned: true, schedules, forecasts };
  }

  if (nextHasSchedule || nextMatchesCurrentCalendar) {
    schedules = {
      current: promoteSchedule(schedules.next, 'current', calendarCurrentMonday),
      next: buildEmptySchedule('next', calendarNextMonday),
    };
    forecasts = {
      current: realignForecast('current', forecasts.next, reference),
      next: buildForecastRows('next', reference, []),
    };
    rotated = true;
  } else if (currentHasSchedule) {
    forecasts = {
      current: realignForecast('current', forecasts.current, reference),
      next: realignForecast('next', forecasts.next, reference),
    };
    schedules = {
      current: promoteSchedule(schedules.current, 'current', calendarCurrentMonday),
      next: buildEmptySchedule('next', calendarNextMonday),
    };
    return { changed: true, rotated: false, realigned: true, schedules, forecasts };
  } else {
    schedules = {
      current: buildEmptySchedule('current', calendarCurrentMonday),
      next: buildEmptySchedule('next', calendarNextMonday),
    };
    forecasts = {
      current: buildForecastRows('current', reference, []),
      next: buildForecastRows('next', reference, []),
    };
    rotated = true;
  }

  return { changed: true, rotated, schedules, forecasts };
}
