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
import {
  NAV_PAGES,
  MORE_PAGE_IDS,
  isMobileLayout,
  desktopNavIds,
  mobileBottomNavIds,
  mobileTopNavIds,
  bottomNavActiveId,
} from './nav.js';

let activePage = 'horario';
/** @type {HTMLElement | null} */
let viewRoot = null;
let navEventsBound = false;
let resizeTimer = null;

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
    salesTracking: payload.salesTracking,
    currentUserId: payload.currentUserId || SEED_AGENTS[0]?.id || null,
  });

  await syncForecastCalendar();
  await syncApprovedPipeline();
  await initCloud();

  viewRoot = document.getElementById('view-root');

  bindShellEvents();
  renderUserPicker();
  renderAllNav(activePage);
  renderActiveView();
  updateFabVisibility();

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateFabVisibility();
      renderAllNav(activePage);
    }, 120);
  });

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
    renderAllNav(activePage);
    renderActiveView();
    updateFabVisibility();
  });
}

function bindShellEvents() {
  if (navEventsBound) return;
  navEventsBound = true;

  document.getElementById('desktop-nav')?.addEventListener('click', onNavClick);
  document.getElementById('mobile-top-nav')?.addEventListener('click', onNavClick);
  document.getElementById('mobile-bottom-nav')?.addEventListener('click', onNavClick);
  document.getElementById('more-menu-grid')?.addEventListener('click', onNavClick);

  document.getElementById('more-menu-close')?.addEventListener('click', closeMoreMenu);
  document.getElementById('more-menu')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeMoreMenu();
  });

  document.getElementById('fab-resumen')?.addEventListener('click', () => {
    navigateTo('resumen');
  });
}

function onNavClick(event) {
  const btn = event.target.closest('[data-page]');
  if (!btn) return;
  event.preventDefault();
  navigateTo(btn.dataset.page);
}

function navigateTo(page) {
  if (page === 'more') {
    openMoreMenu();
    return;
  }
  closeMoreMenu();
  activePage = page;
  setUiPage(page);
  renderAllNav(page);
  renderActiveView();
  updateFabVisibility();
  viewRoot?.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMoreMenu() {
  const dialog = document.getElementById('more-menu');
  renderMoreMenuGrid();
  dialog?.showModal();
}

function closeMoreMenu() {
  document.getElementById('more-menu')?.close();
}

function renderMoreMenuGrid() {
  const grid = document.getElementById('more-menu-grid');
  if (!grid) return;
  grid.innerHTML = MORE_PAGE_IDS.map((id) => {
    const item = NAV_PAGES[id];
    return `
      <button type="button" class="more-menu__item ${activePage === id ? 'is-active' : ''}" data-page="${id}">
        <span class="more-menu__emoji">${item.emoji}</span>
        <span>${item.label}</span>
      </button>
    `;
  }).join('');
}

function renderAllNav(active) {
  renderDesktopNav(active);
  renderMobileTopNav(active);
  renderMobileBottomNav(active);
}

function navButton(item, activeId, variant) {
  const isActive = item.id === activeId || (item.id === 'more' && MORE_PAGE_IDS.includes(activeId));
  const label = variant === 'bottom' ? item.short : item.label;
  return `
    <button
      type="button"
      class="nav-btn nav-btn--${variant} ${isActive ? 'is-active' : ''}"
      data-page="${item.id}"
      aria-current="${isActive ? 'page' : 'false'}"
    >
      <span class="nav-btn__emoji" aria-hidden="true">${item.emoji}</span>
      <span class="nav-btn__label">${label}</span>
    </button>
  `;
}

function renderDesktopNav(active) {
  const nav = document.getElementById('desktop-nav');
  if (!nav) return;
  const ids = desktopNavIds(isAdminUser());
  nav.innerHTML = ids.map((id) => navButton(NAV_PAGES[id], active, 'desktop')).join('');
}

function renderMobileTopNav(active) {
  const nav = document.getElementById('mobile-top-nav');
  if (!nav) return;
  const ids = mobileTopNavIds(isAdminUser());
  nav.innerHTML = ids.map((id) => navButton(NAV_PAGES[id], active, 'top')).join('');
}

function renderMobileBottomNav(active) {
  const nav = document.getElementById('mobile-bottom-nav');
  if (!nav) return;
  const ids = mobileBottomNavIds(isAdminUser());
  const activeBottom = bottomNavActiveId(active, isAdminUser());
  const items = ids.map((id) => {
    if (id === 'more') {
      return navButton({ id: 'more', label: 'Más', short: 'Más', emoji: '⋯' }, activeBottom, 'bottom');
    }
    return navButton(NAV_PAGES[id], activeBottom, 'bottom');
  });
  nav.innerHTML = items.join('');
  nav.hidden = !isMobileLayout() && ids.length <= 3;
}

function updateFabVisibility() {
  const fab = document.getElementById('fab-resumen');
  if (!fab) return;
  const show = isMobileLayout() && activePage !== 'resumen';
  fab.classList.toggle('hidden', !show);
}

function renderUserPicker() {
  const host = document.getElementById('user-picker');
  if (!host) return;
  const state = getState();
  const currentId = state.ui.currentUserId;
  host.innerHTML = `
    <label class="user-picker">
      <span class="user-picker__label">Usuario</span>
      <select id="current-user-select" aria-label="Seleccionar usuario">
        ${state.agents.ids.map((id) => {
    const agent = state.agents.byId[id];
    if (!agent?.active && id !== currentId) return '';
    return `<option value="${id}" ${id === currentId ? 'selected' : ''}>${agent.name} (${agent.category})</option>`;
  }).join('')}
      </select>
    </label>
  `;
  const select = host.querySelector('#current-user-select');
  select?.addEventListener('change', async () => {
    setCurrentUserId(select.value);
    await persistCurrentUserId();
    if (!isAdminUser() && ['dashboard', 'equipo', 'forecast', 'excepciones', 'seguimiento'].includes(activePage)) {
      navigateTo('horario');
    } else {
      renderAllNav(activePage);
      renderActiveView();
    }
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
