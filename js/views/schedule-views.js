import { getState, setVisibleWeek } from '../store.js';
import { renderScheduleGrid, bindScheduleGrid } from './schedule-grid.js';
import { renderPublishedSchedule } from './published-schedule.js';
import { renderDistributionPanel } from './distribution-panel.js';
import { dayHeaders, weekRangeLabel } from '../utils/calendar.js';
import { persistVisibleWeek } from '../actions/persist.js';

export function renderHorarioView(container) {
  const state = getState();
  const weekKey = state.visibleWeek;
  const headers = dayHeaders(state.forecasts[weekKey], weekKey);

  container.innerHTML = `
    <div class="view-header view-header--compact">
      <div>
        <h2>Horario semanal</h2>
        <p class="view-subtitle">Vista para captura y WhatsApp. Solo lectura.</p>
      </div>
      ${renderWeekSelector(weekKey)}
    </div>
    <div id="published-mount"></div>
  `;

  bindWeekSelector(container, weekKey, () => renderHorarioView(container));

  const mount = container.querySelector('#published-mount');
  mount.innerHTML = renderPublishedSchedule({ weekKey, headers });
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

function bindWeekSelector(container, weekKey, rerender) {
  const select = container.querySelector('#visible-week-select');
  if (!select) return;
  select.addEventListener('change', async () => {
    setVisibleWeek(select.value);
    await persistVisibleWeek();
    rerender();
  });
}

export function renderDashboardView(container) {
  const state = getState();
  const weekKey = state.visibleWeek;
  const headers = dayHeaders(state.forecasts[weekKey], weekKey);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Dashboard</h2>
        <p class="view-subtitle">Arrastra agentes o usa + para corregir. Revisa indicadores abajo.</p>
      </div>
      ${renderWeekSelector(weekKey)}
    </div>
    <div id="distribution-mount"></div>
    <div id="schedule-mount"></div>
  `;

  bindWeekSelectorDashboard(container, weekKey);

  container.querySelector('#distribution-mount').innerHTML = renderDistributionPanel(weekKey);

  const mount = container.querySelector('#schedule-mount');
  mount.innerHTML = renderScheduleGrid({
    weekKey,
    headers,
    canEdit: true,
  });
  bindScheduleGrid(mount, { canEdit: true });
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
