import { DAYS } from '../../domain/constants.js';
import {
  ALERT_KIND,
  collectScheduleAlerts,
  daysWithAlertKinds,
  otherAlertCount,
  unassignedAgentsByDay,
  unassignedCount,
} from '../../domain/scheduleAlerts.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildDashboardAlerts(state, weekKey) {
  const schedule = state.schedules[weekKey];
  const agents = state.agents.ids.map((id) => state.agents.byId[id]).filter(Boolean);
  return collectScheduleAlerts({
    days: schedule?.days || {},
    agents,
    forecast: state.forecasts[weekKey] || [],
    exceptions: state.exceptions,
    morningWbdMap: state.morningWbdMap,
  });
}

export function renderDashboardAlertsPanel(alerts, headers = []) {
  const unassignedByDay = unassignedAgentsByDay(alerts);
  const unassignedDays = Object.keys(unassignedByDay);
  const missingCount = unassignedCount(alerts);
  const secondaryCount = otherAlertCount(alerts);
  const secondaryAlerts = alerts.filter((alert) => alert.kind !== ALERT_KIND.UNASSIGNED);

  if (!missingCount && !secondaryCount) {
    return `
      <section class="dashboard-alerts dashboard-alerts--ok panel" aria-live="polite">
        <p class="dashboard-alerts__ok">Semana completa: todos los agentes activos tienen posición en cada día.</p>
      </section>
    `;
  }

  const unassignedList = unassignedDays.map((day) => {
    const dayIndex = DAYS.indexOf(day);
    const label = headers[dayIndex] || day;
    const names = unassignedByDay[day].join(', ');
    return `
      <li class="dashboard-alerts__item dashboard-alerts__item--critical">
        <span class="dashboard-alerts__day">${escapeHtml(label)}</span>
        <span class="dashboard-alerts__names">${escapeHtml(names)}</span>
      </li>
    `;
  }).join('');

  const secondaryList = secondaryAlerts.map((alert) => `
    <li class="dashboard-alerts__item">${escapeHtml(alert.message)}</li>
  `).join('');

  return `
    <section class="dashboard-alerts dashboard-alerts--warn panel" aria-live="polite">
      ${missingCount ? `
        <div class="dashboard-alerts__head">
          <strong class="dashboard-alerts__title">Agentes sin asignar</strong>
          <span class="dashboard-alerts__badge">${missingCount} en ${unassignedDays.length} día${unassignedDays.length === 1 ? '' : 's'}</span>
        </div>
        <ul class="dashboard-alerts__list">${unassignedList}</ul>
      ` : ''}
      ${secondaryCount ? `
        <details class="dashboard-alerts__details" ${missingCount ? '' : 'open'}>
          <summary>Otras alertas (${secondaryCount})</summary>
          <ul class="dashboard-alerts__list dashboard-alerts__list--secondary">${secondaryList}</ul>
        </details>
      ` : ''}
    </section>
  `;
}

export function renderDayUnassignedStrip(alerts, selectedDay) {
  const names = unassignedAgentsByDay(alerts)[selectedDay] || [];
  if (!names.length) return '';
  return `
    <div class="dashboard-alerts__day-strip" role="alert">
      <strong>Sin asignar hoy:</strong> ${escapeHtml(names.join(', '))}
    </div>
  `;
}

export function dayPickerLabel(day, header, alerts) {
  const hasIssue = daysWithAlertKinds(alerts, [ALERT_KIND.UNASSIGNED]).has(day);
  return hasIssue ? `${header} ⚠` : header;
}
