import { DAYS } from '../../domain/constants.js';

export function mondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(iso, offset) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return formatIsoDate(date);
}

export function weekMondayIso(weekKey = 'current') {
  const base = mondayOfWeek();
  if (weekKey === 'next') base.setDate(base.getDate() + 7);
  return formatIsoDate(base);
}

export function weekRangeLabel(weekKey = 'current') {
  const start = weekMondayIso(weekKey);
  const end = addDaysIso(start, 6);
  return `${start} — ${end}`;
}

export function dayHeaders(forecastRows = [], weekKey = 'current') {
  const monday = weekMondayIso(weekKey);
  return DAYS.map((day, index) => {
    const date = forecastRows[index]?.date || addDaysIso(monday, index);
    const dayNum = date ? new Date(`${date}T00:00:00`).getDate() : '';
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
