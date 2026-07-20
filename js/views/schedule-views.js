import { getState, setVisibleWeek } from '../store.js';
import { renderScheduleGrid, bindScheduleGrid } from './schedule-grid.js';
import { dayHeaders, weekRangeLabel } from '../utils/calendar.js';
import { persistVisibleWeek } from '../actions/persist.js';

export function renderHorarioView(container) {
  const state = getState();
  const weekKey = state.visibleWeek;
  const headers = dayHeaders(state.forecasts[weekKey], weekKey);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2>Horario semanal</h2>
        <p class="view-subtitle">Vista publicada — solo lectura. Para editar usa Dashboard.</p>
      </div>
      ${renderWeekSelector(weekKey)}
    </div>
    <div id="schedule-mount"></div>
  `;

  bindWeekSelector(container, weekKey);

  const mount = container.querySelector('#schedule-mount');
  mount.innerHTML = renderScheduleGrid({
    weekKey,
    headers,
    canEdit: false,
  });
  bindScheduleGrid(mount, { canEdit: false });
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

function bindWeekSelector(container, weekKey) {
  const select = container.querySelector('#visible-week-select');
  if (!select) return;
  select.addEventListener('change', async () => {
    setVisibleWeek(select.value);
    await persistVisibleWeek();
    renderHorarioView(container);
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
        <p class="view-subtitle">Arrastra agentes o usa + para corregir asignaciones. Cambios se guardan automáticamente.</p>
      </div>
      ${renderWeekSelector(weekKey)}
    </div>
    <div id="schedule-mount"></div>
  `;

  bindWeekSelectorDashboard(container, weekKey);

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
