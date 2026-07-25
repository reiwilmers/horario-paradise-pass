import { DAYS } from '../../domain/constants.js';
import { LOBBY_BLOCKS } from '../../domain/blocks.js';
import { forecastRowMetrics } from '../actions/forecast.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function countLobbyAssignedForDay(dayPlan = {}) {
  return LOBBY_BLOCKS.reduce((sum, block) => sum + ((dayPlan[block] || []).length), 0);
}

export function dayForecastContext({ forecastRow = {}, settings = {}, scheduleDay = {} } = {}) {
  const metrics = forecastRowMetrics(forecastRow, settings);
  const total = Number(forecastRow.total) || 0;
  const lobbyTarget = forecastRow.lobby !== '' && forecastRow.lobby != null
    ? Number(forecastRow.lobby)
    : metrics.lobbySuggested;
  const lobbyAssigned = countLobbyAssignedForDay(scheduleDay);
  let lobbyTone = 'ok';
  if (lobbyTarget > 0) {
    if (lobbyAssigned < lobbyTarget) lobbyTone = 'low';
    else if (lobbyAssigned > lobbyTarget) lobbyTone = 'high';
  }
  return {
    total,
    realExits: metrics.realExits,
    lobbyTarget,
    lobbyAssigned,
    level: forecastRow.level || '—',
    lobbyTone,
    hasForecast: total > 0,
  };
}

function metricCell(label, value, tone = '') {
  return `
    <div class="dashboard-forecast-strip__metric ${tone ? `dashboard-forecast-strip__metric--${tone}` : ''}">
      <span class="dashboard-forecast-strip__label">${escapeHtml(label)}</span>
      <strong class="dashboard-forecast-strip__value">${escapeHtml(String(value))}</strong>
    </div>
  `;
}

export function renderDashboardDayForecastStrip(context) {
  if (!context.hasForecast) {
    return `
      <section class="dashboard-forecast-strip dashboard-forecast-strip--empty panel" aria-label="Forecast del día">
        <p>Sin salidas cargadas para este día. Completa el forecast para ver salidas reales y lobby sugerido.</p>
      </section>
    `;
  }

  const lobbyValue = context.lobbyTarget > 0
    ? `${context.lobbyAssigned} / ${context.lobbyTarget}`
    : context.lobbyAssigned;

  return `
    <section class="dashboard-forecast-strip panel" aria-label="Forecast del día">
      ${metricCell('Salidas totales', context.total)}
      ${metricCell('Salidas reales', context.realExits || '—')}
      ${metricCell('Lobby (asig. / sug.)', lobbyValue, context.lobbyTone)}
      ${metricCell('Nivel', context.level)}
    </section>
  `;
}

export function renderDashboardDayForecastCompact(context) {
  if (!context.hasForecast) return '';
  const lobbyValue = context.lobbyTarget > 0
    ? `${context.lobbyAssigned}/${context.lobbyTarget}`
    : String(context.lobbyAssigned);
  return `
    <div class="schedule-grid__forecast ${context.lobbyTone !== 'ok' ? `schedule-grid__forecast--${context.lobbyTone}` : ''}">
      <span>Tot ${context.total}</span>
      <span>Real ${context.realExits || '—'}</span>
      <span>Lob ${lobbyValue}</span>
    </div>
  `;
}

export function forecastContextForDay({ weekKey, day, schedule, forecast, settings }) {
  const dayIndex = DAYS.indexOf(day);
  return dayForecastContext({
    forecastRow: forecast[dayIndex] || {},
    settings,
    scheduleDay: schedule?.days?.[day] || {},
  });
}
