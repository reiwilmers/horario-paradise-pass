import {
  getState,
  patchForecastRow,
  patchForecastSettings,
  patchForecasts,
  syncForecastsInStore,
  loadForecasts,
  loadSchedule,
} from '../store.js';
import {
  calculateLobbySuggested,
  calculateRealExits,
  enrichForecastLobby,
} from '../../domain/forecast.js';
import { applyWeekRollover } from '../../domain/weekRollover.js';
import * as db from '../db.js';
import { queueOperationalCloudSync, markLocalOperationalEdited } from '../cloud.js';
import { showSuccess } from '../utils/toast.js';

export async function persistForecast(weekKey) {
  const key = weekKey === 'next' ? 'next' : 'current';
  await db.put('forecasts', { weekKey: key, rows: getState().forecasts[key] });
  markLocalOperationalEdited();
  queueOperationalCloudSync();
}

export async function persistForecastSettings() {
  await db.setSetting('forecastSettings', getState().forecastSettings);
  markLocalOperationalEdited();
  queueOperationalCloudSync();
}

export async function persistForecastEditWeek() {
  await db.setSetting('forecastEditWeek', getState().forecastEditWeek);
  queueOperationalCloudSync();
}

export async function syncForecastCalendar(reference = new Date()) {
  const rollover = applyWeekRollover(getState(), reference);

  if (rollover.changed) {
    loadSchedule('current', rollover.schedules.current);
    loadSchedule('next', rollover.schedules.next);
    loadForecasts(rollover.forecasts.current, rollover.forecasts.next);
    await db.put('schedules', rollover.schedules.current);
    await db.put('schedules', rollover.schedules.next);
    await persistForecast('current');
    await persistForecast('next');
    if (rollover.rotated) {
      showSuccess('Nueva semana: la próxima pasó a actual y la siguiente quedó en blanco.');
    }
    return getState().forecasts;
  }

  syncForecastsInStore(reference);
  await persistForecast('current');
  await persistForecast('next');
  return getState().forecasts;
}

export async function updateForecastCell(weekKey, index, field, value) {
  const patch = { [field]: value };
  if (field === 'total') {
    const settings = getState().forecastSettings;
    const total = Number(value);
    if (Number.isFinite(total) && total >= 0) {
      patch.lobby = calculateLobbySuggested(total, settings);
    }
  }
  patchForecastRow(weekKey, index, patch);
  await persistForecast(weekKey);
}

export async function updateForecastSettings(settings) {
  patchForecastSettings(settings);
  const weekKey = getState().forecastEditWeek;
  const rows = enrichForecastLobby(getState().forecasts[weekKey], getState().forecastSettings);
  patchForecasts(weekKey, rows);
  await persistForecastSettings();
  await persistForecast(weekKey);
  showSuccess('Ajustes de forecast guardados.');
}

export function forecastRowMetrics(row, settings) {
  const total = Number(row.total) || 0;
  return {
    realExits: calculateRealExits(total, settings),
    lobbySuggested: calculateLobbySuggested(total, settings),
  };
}
