import { DAYS } from '../../domain/constants.js';
import { buildWhatsAppDayText, defaultWhatsAppShareDay } from '../../domain/whatsappShare.js';
import { getState, setVisibleWeek, isAdminUser } from '../store.js';
import { renderPublishedSchedule } from './published-schedule.js';
import { renderMobileScheduleDays } from './mobile-schedule-days.js';
import { renderDistributionPanel } from './distribution-panel.js';
import {
  renderScheduleDayEditor,
  bindScheduleDayEditor,
  shouldUseDayEditor,
} from './schedule-day-editor.js';
import { renderScheduleGrid, bindScheduleGrid } from './schedule-grid.js';
import { dayHeaders, weekRangeLabel } from '../utils/calendar.js';
import { persistVisibleWeek } from '../actions/persist.js';
import { copyTextToClipboard, downloadScheduleImage } from '../utils/scheduleExport.js';
import {
  buildAllDashboardAlerts,
  buildDashboardEditAlerts,
  renderDashboardAlertsPanel,
  renderWeekUnassignedOverview,
} from './dashboard-alerts-panel.js';
import { scheduleWorkflowPhase } from '../../domain/scheduleWorkflow.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPublishedDayCards(weekKey, headers) {
  const state = getState();
  return renderMobileScheduleDays({
    headers,
    schedule: state.schedules[weekKey],
    agentsById: state.agents.byId,
    morningWbdMap: state.morningWbdMap,
    forecast: state.forecasts[weekKey] || [],
    exceptions: state.exceptions,
  });
}

function renderWeekSelector(weekKey) {
  return `
    <label class="week-selector">
      Semana
      <select id="visible-week-select">
        <option value="current" ${weekKey === 'current' ? 'selected' : ''}>Actual (${weekRangeLabel('current')})</option>
        <option value="next" ${weekKey === 'next' ? 'selected' : ''}>Próxima (${weekRangeLabel('next')})</option>
      </select>
    </label>
  `;
}

function renderWhatsAppControls(weekKey, headers, selectedDay, salaOp = '', lobbyOp = '') {
  return `
    <div class="horario-share-controls">
      <label class="week-selector">
        Día WhatsApp
        <select id="horario-share-day">
          ${DAYS.map((day, index) => `
            <option value="${day}" ${day === selectedDay ? 'selected' : ''}>${escapeHtml(headers[index] || day)}</option>
          `).join('')}
        </select>
      </label>
      <label class="horario-op-input">
        Sala op.
        <input id="horario-sala-op" class="field-input" inputmode="numeric" placeholder="Opcional" value="${escapeHtml(salaOp)}" />
      </label>
      <label class="horario-op-input">
        Lobby op.
        <input id="horario-lobby-op" class="field-input" inputmode="numeric" placeholder="Opcional" value="${escapeHtml(lobbyOp)}" />
      </label>
    </div>
  `;
}

function bindWeekSelector(container, rerender) {
  const select = container.querySelector('#visible-week-select');
  if (!select) return;
  select.addEventListener('change', async () => {
    setVisibleWeek(select.value);
    await persistVisibleWeek();
    rerender();
  });
}

function bindHorarioShare(container, weekKey) {
  container.querySelector('#horario-image-btn')?.addEventListener('click', async () => {
    const source = container.querySelector('#published-mount .published-schedule');
    const filename = `horario-${weekRangeLabel(weekKey).replace(/\s+/g, '')}.png`;
    await downloadScheduleImage(source, filename);
  });

  container.querySelector('#horario-share-btn')?.addEventListener('click', async () => {
    const state = getState();
    const day = container.querySelector('#horario-share-day')?.value;
    const salaOpportunities = container.querySelector('#horario-sala-op')?.value?.trim() || '';
    const lobbyOpportunities = container.querySelector('#horario-lobby-op')?.value?.trim() || '';
    const text = buildWhatsAppDayText({
      day,
      schedule: state.schedules[weekKey],
      agentsById: state.agents.byId,
      morningWbdMap: state.morningWbdMap,
      salaOpportunities,
      lobbyOpportunities,
    });
    await copyTextToClipboard(text);
  });
}

export function renderHorarioView(container) {
  const state = getState();
  const weekKey = state.visibleWeek;
  const headers = dayHeaders(state.forecasts[weekKey], weekKey);
  const canShare = isAdminUser();
  const selectedDay = container.dataset.horarioShareDay
    || defaultWhatsAppShareDay(weekKey, state.forecasts[weekKey] || []);
  const salaOp = container.dataset.horarioSalaOp || '';
  const lobbyOp = container.dataset.horarioLobbyOp || '';

  container.innerHTML = `
    <div class="view-header view-header--compact">
      <div>
        <h2>Horario semanal</h2>
        <p class="view-subtitle">${canShare
    ? 'Descarga la imagen para el grupo o copia el texto con @ para avisos nocturnos.'
    : 'Consulta el horario publicado de la semana.'}</p>
      </div>
      <div class="view-actions view-actions--wrap">
        ${renderWeekSelector(weekKey)}
        ${canShare ? renderWhatsAppControls(weekKey, headers, selectedDay, salaOp, lobbyOp) : ''}
        ${canShare ? `
        <button type="button" class="btn-secondary" id="horario-image-btn">Descargar imagen</button>
        <button type="button" class="btn-primary" id="horario-share-btn">Copiar texto WhatsApp</button>
        ` : ''}
      </div>
    </div>
    <div id="published-mount" class="published-desktop"></div>
    <div id="published-mobile-cards" class="published-mobile-cards"></div>
  `;

  if (canShare) {
    container.querySelector('#horario-share-day')?.addEventListener('change', (event) => {
      container.dataset.horarioShareDay = event.target.value;
    });
    container.querySelector('#horario-sala-op')?.addEventListener('input', (event) => {
      container.dataset.horarioSalaOp = event.target.value;
    });
    container.querySelector('#horario-lobby-op')?.addEventListener('input', (event) => {
      container.dataset.horarioLobbyOp = event.target.value;
    });
    bindHorarioShare(container, weekKey);
  }

  bindWeekSelector(container, () => renderHorarioView(container));

  container.querySelector('#published-mount').innerHTML = renderPublishedSchedule({ weekKey, headers });
  container.querySelector('#published-mobile-cards').innerHTML = renderPublishedDayCards(weekKey, headers);
}

export function renderDashboardView(container) {
  const state = getState();
  const weekKey = state.visibleWeek;
  const headers = dayHeaders(state.forecasts[weekKey], weekKey);
  const useDayEditor = shouldUseDayEditor();
  const selectedDay = container.dataset.dashboardDay || DAYS[0];
  const workflowPhase = scheduleWorkflowPhase();
  const verifyAlerts = buildAllDashboardAlerts(state);
  const editAlerts = buildDashboardEditAlerts(state, weekKey);

  container.innerHTML = `
    <div class="view-header view-header--compact">
      <div>
        <h2>Dashboard</h2>
      </div>
      ${renderWeekSelector(weekKey)}
    </div>
    <div id="dashboard-alerts-mount"></div>
    <div id="dashboard-week-overview-mount"></div>
    <div id="distribution-mount" class="${useDayEditor ? 'dashboard-distribution--mobile-collapsed' : ''}"></div>
    <div id="schedule-mount"></div>
  `;

  bindWeekSelectorDashboard(container, weekKey);
  const alertsMount = container.querySelector('#dashboard-alerts-mount');
  if (alertsMount) {
    alertsMount.innerHTML = workflowPhase === 'verify'
      ? renderDashboardAlertsPanel(verifyAlerts, dayHeaders(state.forecasts.next, 'next'))
      : '';
  }
  container.querySelector('#dashboard-week-overview-mount').innerHTML = useDayEditor
    ? renderWeekUnassignedOverview(editAlerts, headers)
    : '';
  container.querySelector('#distribution-mount').innerHTML = useDayEditor
    ? `<details class="dashboard-distribution-details panel">
        <summary>Indicadores de la semana</summary>
        ${renderDistributionPanel(weekKey)}
      </details>`
    : renderDistributionPanel(weekKey);

  const mount = container.querySelector('#schedule-mount');
  if (useDayEditor) {
    mount.innerHTML = renderScheduleDayEditor({
      weekKey,
      headers,
      selectedDay,
      dashboardAlerts: editAlerts,
    });
    bindScheduleDayEditor(mount, {
      weekKey,
      headers,
      onDayChange: (day) => {
        container.dataset.dashboardDay = day;
        renderDashboardView(container);
      },
    });
  } else {
    mount.innerHTML = renderScheduleGrid({ weekKey, headers, canEdit: true, showDayForecast: true, editAlerts });
    bindScheduleGrid(mount, { canEdit: true });
  }
}

function bindWeekSelectorDashboard(container, weekKey) {
  const select = container.querySelector('#visible-week-select');
  if (!select) return;
  select.addEventListener('change', async () => {
    setVisibleWeek(select.value);
    await persistVisibleWeek();
    renderDashboardView(container);
  });
}
