import { DAYS } from '../../domain/constants.js';
import {
  addDaysIso as domainAddDaysIso,
  calendarWeekDates,
  formatIsoDate,
  weekMondayIso as domainWeekMondayIso,
  weekRangeLabel as domainWeekRangeLabel,
} from '../../domain/forecast.js';

export { formatIsoDate };

export function mondayOfWeek(date = new Date()) {
  return calendarWeekDates('current', date)[0]
    ? new Date(`${calendarWeekDates('current', date)[0].date}T12:00:00`)
    : new Date(date);
}

export function addDaysIso(iso, offset) {
  return domainAddDaysIso(iso, offset);
}

export function weekMondayIso(weekKey = 'current', reference = new Date()) {
  return domainWeekMondayIso(weekKey, reference);
}

export function weekRangeLabel(weekKey = 'current', reference = new Date()) {
  return domainWeekRangeLabel(weekKey, reference);
}

export function dayHeaders(forecastRows = [], weekKey = 'current', reference = new Date()) {
  const monday = weekMondayIso(weekKey, reference);
  return DAYS.map((day, index) => {
    const date = forecastRows[index]?.date || addDaysIso(monday, index);
    const dayNum = date ? new Date(`${date}T12:00:00`).getDate() : '';
    return `${day} ${dayNum}`.trim();
  });
}

export function scheduleHasAssignments(schedule) {
  if (!schedule?.days) return false;
  return DAYS.some((day) => {
    const dayPlan = schedule.days[day];
    if (!dayPlan) return false;
    return Object.values(dayPlan).some((list) => list?.length > 0);
  });
}
