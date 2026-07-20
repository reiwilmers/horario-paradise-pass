import * as db from './db.js';
import { SEED_AGENTS } from './seed-data.js';
import {
  getState,
  subscribe,
  setUiPage,
  hydrateFromDb,
  setCurrentUserId,
  isAdminUser,
} from './store.js';
import { loadStateFromDb } from './actions/persist.js';
import { persistCurrentUserId } from './actions/persist.js';
import { renderHorarioView, renderDashboardView } from './views/schedule-views.js';
import { renderEquipoView } from './views/equipo-view.js';
import { renderForecastView } from './views/forecast-view.js';
import { renderSolicitudesView } from './views/solicitudes-view.js';
import { renderExcepcionesView } from './views/excepciones-view.js';
import { renderResumenView } from './views/resumen-view.js';
import { renderPerformanceView } from './views/performance-view.js';
import { syncForecastCalendar } from './actions/forecast.js';
import { syncApprovedPipeline } from './actions/approved.js';
import { initCloud } from './cloud.js';

const BASE_NAV = [
  { id: 'horario', label: 'Horario semanal' },
  { id: 'resumen', label: 'Mi horario' },
  { id: 'solicitudes', label: 'Solicitudes' },
];

const ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'excepciones', label: 'Excepciones' },
  { id: 'seguimiento', label: 'Seguimiento anual' },
];

let activePage = 'horario';
/** @type {HTMLElement | null} */
let viewRoot = null;

function navItems() {
  if (isAdminUser()) return [...BASE_NAV.slice(0, 2), ...ADMIN_NAV, BASE_NAV[2]];
  return BASE_NAV;
}

async function init() {
  await db.openDB();
  await db.seedDefaults();
  const payload = await loadStateFromDb();
  hydrateFromDb({
    agents: payload.agents?.length ? payload.agents : SEED_AGENTS,
    schedules: payload.schedules,
    forecasts: payload.forecasts,
    morningWbdMap: payload.morningWbdMap,
    visibleWeek: payload.visibleWeek || 'current',
    forecastSettings: payload.forecastSettings,
    forecastEditWeek: payload.forecastEditWeek,
    requests: payload.requests,
    exceptions: payload.exceptions,
    currentUserId: payload.currentUserId || SEED_AGENTS[0]?.id || null,
  });

  await syncForecastCalendar();
  await syncApprovedPipeline();
  await initCloud();

  viewRoot = document.getElementById('view-root');

  renderUserPicker();
  renderNav(activePage);
  renderActiveView();

  let lastRenderSig = '';
  subscribe(() => {
    renderUserPicker();
    const sig = JSON.stringify({
      schedules: getState().schedules,
      visibleWeek: getState().visibleWeek,
      forecastEditWeek: getState().forecastEditWeek,
      forecasts: getState().forecasts,
      forecastSettings: getState().forecastSettings,
      morningWbdMap: getState().morningWbdMap,
      agents: getState().agents,
    requests: getState().requests,
    exceptions: getState().exceptions,
    salesTracking: getState().salesTracking,
    currentUserId: getState().ui.currentUserId,
      page: activePage,
    });
    if (sig === lastRenderSig) return;
    lastRenderSig = sig;
    renderNav(activePage);
    renderActiveView();
  });
}

function renderUserPicker() {
  const host = document.getElementById('user-picker');
  if (!host) return;
  const state = getState();
  const currentId = state.ui.currentUserId;
  host.innerHTML = `
    <label class="user-picker">
      <span>Usuario</span>
      <select id="current-user-select">
        ${state.agents.ids.map((id) => {
    const agent = state.agents.byId[id];
    return `<option value="${id}" ${id === currentId ? 'selected' : ''}>${agent.name} (${agent.category})</option>`;
  }).join('')}
      </select>
    </label>
  `;
  const select = host.querySelector('#current-user-select');
  select?.addEventListener('change', async () => {
    setCurrentUserId(select.value);
    await persistCurrentUserId();
  });
}

function renderNav(active) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const items = navItems();
  nav.innerHTML = items.map((item) => (
    `<button type="button" data-page="${item.id}" class="${item.id === active ? 'active' : ''}">${item.label}</button>`
  )).join('');
  nav.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activePage = btn.dataset.page || 'horario';
      setUiPage(activePage);
      nav.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderActiveView();
    });
  });
}

function renderActiveView() {
  if (!viewRoot) return;
  const page = activePage;

  if (page === 'horario') {
    renderHorarioView(viewRoot);
    return;
  }
  if (page === 'resumen') {
    renderResumenView(viewRoot);
    return;
  }
  if (page === 'dashboard') {
    renderDashboardView(viewRoot);
    return;
  }
  if (page === 'equipo') {
    renderEquipoView(viewRoot);
    return;
  }
  if (page === 'forecast') {
    renderForecastView(viewRoot);
    return;
  }
  if (page === 'solicitudes') {
    renderSolicitudesView(viewRoot);
    return;
  }
  if (page === 'excepciones') {
    renderExcepcionesView(viewRoot);
    return;
  }
  if (page === 'seguimiento') {
    renderPerformanceView(viewRoot);
  }
}

function renderToasts() {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const toasts = getState().ui.toasts || [];
  host.innerHTML = toasts.map((t) => (
    `<div class="toast toast--${t.type}">${t.message}</div>`
  )).join('');
}

subscribe(renderToasts);

init().catch(console.error);
