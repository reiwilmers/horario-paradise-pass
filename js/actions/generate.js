import { generateSchedule } from '../../domain/generateSchedule.js';
import { weekMondayIso } from '../../domain/forecast.js';
import {
  getState,
  patchScheduleDays,
  patchMorningWbdMap,
  setVisibleWeek,
  activeAgents,
} from '../store.js';
import { persistSchedule, persistMorningWbdMap, persistVisibleWeek } from './persist.js';
import { showError, showSuccess } from '../utils/toast.js';

export async function generateScheduleForWeek(weekKey = getState().forecastEditWeek) {
  const state = getState();
  const key = weekKey === 'next' ? 'next' : 'current';
  const forecast = state.forecasts[key] || [];
  const agents = activeAgents();
  if (!agents.length) {
    showError('No hay agentes activos para generar el horario.');
    return { ok: false, errors: ['no agents'] };
  }

  const hasTotals = forecast.some((row) => Number(row.total) > 0);
  if (!hasTotals) {
    showError('Agrega salidas totales en el forecast antes de generar.');
    return { ok: false, errors: ['empty forecast'] };
  }

  const result = generateSchedule({
    agents,
    forecast,
    exceptions: state.exceptions || [],
    forecastSettings: state.forecastSettings,
    previousMorningWbdMap: state.morningWbdMap,
  });

  patchScheduleDays(key, result.days, { mondayIso: weekMondayIso(key), weekKey: key });
  patchMorningWbdMap(result.morningWbdMap);

  await persistSchedule(key);
  await persistMorningWbdMap();

  if (state.visibleWeek !== key) {
    setVisibleWeek(key);
    await persistVisibleWeek();
  }

  const alertCount = result.alerts.length;
  if (alertCount) {
    showSuccess(`Horario generado (${key}) con ${alertCount} alerta${alertCount === 1 ? '' : 's'}. Revisa Dashboard.`);
  } else {
    showSuccess(`Horario generado para semana ${key === 'next' ? 'próxima' : 'actual'}.`);
  }

  return { ok: true, alerts: result.alerts, weekKey: key };
}

export { generateSchedule };
