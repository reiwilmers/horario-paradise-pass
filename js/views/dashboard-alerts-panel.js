import { DAYS } from '../../domain/constants.js';
import {
  ALERT_KIND,
  collectUnassignedAlerts,
  daysWithAlertKinds,
  unassignedAgentsByDay,
  unassignedCount,
} from '../../domain/scheduleAlerts.js';
import { agentIdsInDay } from '../../domain/schedule.js';
import { forecastDateForDay } from '../../domain/forecast.js';
import { isAgentOnVacationOnDate } from '../../domain/vacations.js';
import {
  collectUnassignedGroupsForPhase,
  scheduleWorkflowPhase,
} from '../../domain/scheduleWorkflow.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildAllDashboardAlerts(state, reference = new Date()) {
  const phase = scheduleWorkflowPhase(reference);
  const agents = state.agents.ids.map((id) => state.agents.byId[id]).filter(Boolean);

  if (phase === 'verify') {
    const groups = collectUnassignedGroupsForPhase(
      phase,
      state.schedules || {},
      state.forecasts || {},
      agents,
      state.exceptions || [],
      reference,
    );
    return groups.flatMap((group) => group.agents.map((agentName) => ({
      kind: ALERT_KIND.UNASSIGNED,
      day: group.day,
      agentName,
      message: `${agentName} | ${group.day} | No aparece en el día.`,
    })));
  }

  return [];
}

/** Unassigned agents for the week currently being edited in Dashboard. */
export function buildDashboardEditAlerts(state, weekKey = state.visibleWeek) {
  const agents = state.agents.ids.map((id) => state.agents.byId[id]).filter(Boolean);
  return collectUnassignedAlerts({
    days: state.schedules[weekKey]?.days || {},
    agents,
    forecast: state.forecasts[weekKey] || [],
    exceptions: state.exceptions || [],
  });
}

export function agentsAvailableForDay(day, { schedule, forecast, exceptions, agents = [] }) {
  const assigned = agentIdsInDay(schedule?.days?.[day] || {});
  const date = forecastDateForDay(forecast, day);
  return agents.filter((agent) => {
    if (!agent?.active) return false;
    if (assigned.has(agent.id)) return false;
    if (isAgentOnVacationOnDate(agent.id, date, exceptions)) return false;
    return true;
  });
}

export function renderDashboardAlertsPanel(alerts, headers = []) {
  const unassignedByDay = unassignedAgentsByDay(alerts);
  const unassignedDays = Object.keys(unassignedByDay);
  const missingCount = unassignedCount(alerts);

  if (!missingCount) {
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

  return `
    <section class="dashboard-alerts dashboard-alerts--warn panel" aria-live="polite">
      <div class="dashboard-alerts__head">
        <strong class="dashboard-alerts__title">Agentes sin asignar — próxima semana</strong>
        <span class="dashboard-alerts__badge">${missingCount} en ${unassignedDays.length} día${unassignedDays.length === 1 ? '' : 's'}</span>
      </div>
      <ul class="dashboard-alerts__list">${unassignedList}</ul>
    </section>
  `;
}

export function renderDayUnassignedStrip(alerts, selectedDay) {
  const names = unassignedAgentsByDay(alerts)[selectedDay] || [];
  if (!names.length) return '';
  return `
    <div class="dashboard-alerts__day-strip" role="alert">
      <strong>Sin rol:</strong> ${escapeHtml(names.join(', '))}
    </div>
  `;
}

export function renderDayUnassignedFooter(alerts, day) {
  const names = unassignedAgentsByDay(alerts)[day] || [];
  return `
    <div class="dashboard-day-footer ${names.length ? 'dashboard-day-footer--warn' : 'dashboard-day-footer--ok'}" role="status">
      ${names.length
    ? `<strong>Sin rol:</strong> ${escapeHtml(names.join(', '))}`
    : '<span>Todos con rol este día.</span>'}
    </div>
  `;
}

export function renderWeekUnassignedOverview(alerts, headers = []) {
  const byDay = unassignedAgentsByDay(alerts);
  const rows = DAYS.map((day, index) => {
    const names = byDay[day] || [];
    const label = headers[index] || day;
    return `
      <div class="dashboard-week-overview__day ${names.length ? 'dashboard-week-overview__day--warn' : ''}">
        <span class="dashboard-week-overview__label">${escapeHtml(label.split(' ')[0])}</span>
        <span class="dashboard-week-overview__names">${names.length ? escapeHtml(names.join(', ')) : '—'}</span>
      </div>
    `;
  }).join('');
  return `
    <section class="dashboard-week-overview panel" aria-label="Resumen sin rol por día">
      <h4 class="dashboard-week-overview__title">Sin rol por día</h4>
      <div class="dashboard-week-overview__grid">${rows}</div>
    </section>
  `;
}

export function dayPickerLabel(day, header, alerts) {
  const hasIssue = daysWithAlertKinds(alerts, [ALERT_KIND.UNASSIGNED]).has(day);
  return hasIssue ? `${header} ⚠` : header;
}
