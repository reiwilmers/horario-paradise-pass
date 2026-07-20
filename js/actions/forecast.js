import {
  getState,
  patchForecastRow,
  patchForecastSettings,
  patchForecasts,
  syncForecastsInStore,
} from '../store.js';
import {
  calculateLobbySuggested,
  calculateRealExits,
  enrichForecastLobby,
} from '../../domain/forecast.js';
import * as db from '../db.js';
import { showSuccess } from '../utils/toast.js';

export async function persistForecast(weekKey) {
  const key = weekKey === 'next' ? 'next' : 'current';
  await db.put('forecasts', { weekKey: key, rows: getState().forecasts[key] });
}

export async function persistForecastSettings() {
  await db.setSetting('forecastSettings', getState().forecastSettings);
}

export async function persistForecastEditWeek() {
  await db.setSetting('forecastEditWeek', getState().forecastEditWeek);
}

export async function syncForecastCalendar() {
  syncForecastsInStore();
  const state = getState();
  await persistForecast('current');
  await persistForecast('next');
  return state.forecasts;
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
