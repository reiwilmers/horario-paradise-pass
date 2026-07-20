import { DAYS } from './constants.js';
import { DEFAULT_FORECAST_SETTINGS } from './constants.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function mondayOfWeek(reference = new Date()) {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function calendarWeekDates(weekKey = 'current', reference = new Date()) {
  const monday = mondayOfWeek(reference);
  if (weekKey === 'next') monday.setDate(monday.getDate() + 7);
  return DAYS.map((day, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return { day, date: formatIsoDate(current) };
  });
}

export function weekMondayIso(weekKey = 'current', reference = new Date()) {
  return calendarWeekDates(weekKey, reference)[0]?.date || '';
}

export function weekRangeLabel(weekKey = 'current', reference = new Date()) {
  const dates = calendarWeekDates(weekKey, reference);
  const first = dates[0]?.date;
  const last = dates[6]?.date;
  if (!first || !last) return weekKey === 'next' ? 'Próxima semana' : 'Semana actual';
  return `${first} — ${last}`;
}

export function forecastMatchesCalendar(forecast = [], weekKey = 'current', reference = new Date()) {
  const expected = calendarWeekDates(weekKey, reference);
  if (!Array.isArray(forecast) || forecast.length !== expected.length) return false;
  return expected.every((row, index) => forecast[index]?.date === row.date);
}

export function buildForecastRows(weekKey = 'current', reference = new Date(), seed = []) {
  const calendar = calendarWeekDates(weekKey, reference);
  return calendar.map((row, index) => {
    const previous = seed[index] || {};
    return {
      day: row.day,
      date: row.date,
      total: previous.total ?? '',
      lobby: previous.lobby ?? '',
      level: previous.level || 'Medio',
      note: previous.note || '',
    };
  });
}

export function syncForecastsToCalendar(forecasts = {}, reference = new Date()) {
  return {
    current: buildForecastRows('current', reference, forecasts.current || []),
    next: buildForecastRows('next', reference, forecasts.next || []),
  };
}

export function calculateRealExits(total, settings = DEFAULT_FORECAST_SETTINGS) {
  const percent = Number(settings.qualificationPercent ?? 0.6);
  return Math.round(Number(total || 0) * percent);
}

export function calculateLobbySuggested(total, settings = DEFAULT_FORECAST_SETTINGS) {
  const percent = Number(settings.qualificationPercent ?? 0.6);
  const shots = Math.max(1, Number(settings.shotsPerAgent ?? 15));
  return Math.floor((Number(total || 0) * percent) / shots);
}

export function enrichForecastLobby(forecast = [], settings = DEFAULT_FORECAST_SETTINGS) {
  return forecast.map((row) => {
    const manual = Number(row.lobby);
    const suggested = Number.isFinite(manual) && manual > 0
      ? manual
      : calculateLobbySuggested(row.total, settings);
    return {
      ...row,
      lobby: suggested > 0 ? suggested : 10,
    };
  });
}

export function lobbySuggestedForDay(forecast = [], day) {
  const index = DAYS.indexOf(day);
  const row = forecast[index] || {};
  const value = Number(row.lobby);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

export function forecastDateForDay(forecast = [], day) {
  const index = DAYS.indexOf(day);
  return forecast[index]?.date || '';
}

export const FORECAST_LEVELS = ['Bajo', 'Medio', 'Fuerte'];
