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
import { renderHorarioView, renderDashboardView } from './views/schedule-views.js';
import { renderEquipoView } from './views/equipo-view.js';
import { renderForecastView } from './views/forecast-view.js';
import { renderSolicitudesView } from './views/solicitudes-view.js';
import { renderExcepcionesView } from './views/excepciones-view.js';
import { renderResumenView } from './views/resumen-view.js';
import { renderPerformanceView } from './views/performance-view.js';
import { renderMonthlyGoalsView } from './views/monthly-goals-view.js';
import { renderLoginView } from './views/login-view.js';
import { syncForecastCalendar } from './actions/forecast.js';
import { syncApprovedPipeline } from './actions/approved.js';
import { initCloud } from './cloud.js';
import {
  attemptLogin,
  completeLogin,
  clearLoginSession,
  loadRememberedLogin,
} from './actions/auth.js';
import {
  NAV_PAGES,
  MORE_PAGE_IDS,
  isMobileLayout,
  desktopNavIds,
  mobileBottomNavIds,
  mobileTopNavIds,
  bottomNavActiveId,
} from './nav.js';

const ADMIN_PAGES = new Set(['dashboard', 'equipo', 'forecast', 'excepciones', 'seguimiento']);

let activePage = 'horario';
let authenticated = false;
let rememberedLogin = { rememberUser: false, rememberPassword: false, agentId: '', password: '' };
/** @type {HTMLElement | null} */
let viewRoot = null;
/** @type {HTMLElement | null} */
let loginRoot = null;
/** @type {HTMLElement | null} */
let appShell = null;
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
    monthlyGoals: payload.monthlyGoals,
  });

  await syncForecastCalendar();
  await syncApprovedPipeline();
  await initCloud();

  viewRoot = document.getElementById('view-root');
  loginRoot = document.getElementById('login-screen');
  appShell = document.getElementById('app');

  bindShellEvents();
  rememberedLogin = await loadRememberedLogin();

  if (rememberedLogin.rememberUser && rememberedLogin.rememberPassword && rememberedLogin.agentId) {
    const result = attemptLogin({
      agentId: rememberedLogin.agentId,
      password: rememberedLogin.password,
      rememberUser: true,
      rememberPassword: true,
    });
    if (result.ok) {
      await completeLogin(result);
      enterApp(result.defaultPage);
      bindDataSubscription();
      return;
    }
  }

  showLoginScreen();
  bindDataSubscription();
}

function bindDataSubscription() {
  let lastRenderSig = '';
  let lastLoginAgentSig = '';
  subscribe(() => {
    const agentSig = JSON.stringify(getState().agents);
    if (!authenticated) {
      if (agentSig !== lastLoginAgentSig && loginRoot && !loginRoot.classList.contains('hidden')) {
        lastLoginAgentSig = agentSig;
        renderLoginView(loginRoot, {
          remembered: rememberedLogin,
          onSubmit: handleLoginSubmit,
        });
      }
      return;
    }
    lastLoginAgentSig = agentSig;
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
      monthlyGoals: getState().monthlyGoals,
      currentUserId: getState().ui.currentUserId,
      page: activePage,
    });
    if (sig === lastRenderSig) return;
    lastRenderSig = sig;
    renderUserSession();
    renderAllNav(activePage);
    renderActiveView();
    updateFabVisibility();
  });
}

function showLoginScreen() {
  authenticated = false;
  setCurrentUserId(null, true);
  appShell?.classList.add('hidden');
  loginRoot?.classList.remove('hidden');
  renderLoginView(loginRoot, {
    remembered: rememberedLogin,
    onSubmit: handleLoginSubmit,
  });
}

async function handleLoginSubmit(credentials) {
  const result = attemptLogin(credentials);
  if (!result.ok) return result;
  await completeLogin(result);
  rememberedLogin = result.remembered;
  enterApp(result.defaultPage);
  return result;
}

function enterApp(page = 'horario') {
  authenticated = true;
  loginRoot?.classList.add('hidden');
  appShell?.classList.remove('hidden');
  activePage = page;
  renderUserSession();
  renderAllNav(activePage);
  renderActiveView();
  updateFabVisibility();

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!authenticated) return;
      updateFabVisibility();
      renderAllNav(activePage);
    }, 120);
  });
}

async function handleLogout() {
  await clearLoginSession(rememberedLogin);
  rememberedLogin = await loadRememberedLogin();
  showLoginScreen();
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
  document.getElementById('fab-resumen')?.addEventListener('click', () => navigateTo('resumen'));
  document.getElementById('user-picker')?.addEventListener('click', (event) => {
    if (event.target.closest('#logout-btn')) handleLogout();
  });
}

function onNavClick(event) {
  const btn = event.target.closest('[data-page]');
  if (!btn) return;
  event.preventDefault();
  navigateTo(btn.dataset.page);
}

function navigateTo(page) {
  if (!authenticated) return;
  if (page === 'more') {
    openMoreMenu();
    return;
  }
  if (ADMIN_PAGES.has(page) && !isAdminUser()) {
    page = 'horario';
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
  renderMoreMenuGrid();
  document.getElementById('more-menu')?.showModal();
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
    <button type="button" class="nav-btn nav-btn--${variant} ${isActive ? 'is-active' : ''}" data-page="${item.id}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="nav-btn__emoji" aria-hidden="true">${item.emoji}</span>
      <span class="nav-btn__label">${label}</span>
    </button>
  `;
}

function renderDesktopNav(active) {
  const nav = document.getElementById('desktop-nav');
  if (!nav) return;
  nav.innerHTML = desktopNavIds(isAdminUser()).map((id) => navButton(NAV_PAGES[id], active, 'desktop')).join('');
}

function renderMobileTopNav(active) {
  const nav = document.getElementById('mobile-top-nav');
  if (!nav) return;
  nav.innerHTML = mobileTopNavIds(isAdminUser()).map((id) => navButton(NAV_PAGES[id], active, 'top')).join('');
}

function renderMobileBottomNav(active) {
  const nav = document.getElementById('mobile-bottom-nav');
  if (!nav) return;
  const ids = mobileBottomNavIds(isAdminUser());
  const activeBottom = bottomNavActiveId(active, isAdminUser());
  nav.innerHTML = ids.map((id) => {
    if (id === 'more') {
      return navButton({ id: 'more', label: 'Más', short: 'Más', emoji: '⋯' }, activeBottom, 'bottom');
    }
    return navButton(NAV_PAGES[id], activeBottom, 'bottom');
  }).join('');
  nav.hidden = !isMobileLayout() && ids.length <= 3;
}

function updateFabVisibility() {
  const fab = document.getElementById('fab-resumen');
  if (!fab) return;
  fab.classList.toggle('hidden', !(isMobileLayout() && activePage !== 'resumen'));
}

function renderUserSession() {
  const host = document.getElementById('user-picker');
  if (!host) return;
  const user = getState().agents.byId[getState().ui.currentUserId];
  if (!user) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = `
    <div class="user-session">
      <span class="user-session__badge">${user.name} · ${user.category}</span>
      <button type="button" id="logout-btn" class="btn-secondary btn-secondary--sm">Salir</button>
    </div>
  `;
}

function renderActiveView() {
  if (!viewRoot || !authenticated) return;
  const page = activePage;

  if (page === 'horario') return renderHorarioView(viewRoot);
  if (page === 'resumen') return renderResumenView(viewRoot);
  if (page === 'dashboard') return renderDashboardView(viewRoot);
  if (page === 'equipo') return renderEquipoView(viewRoot);
  if (page === 'forecast') return renderForecastView(viewRoot);
  if (page === 'solicitudes') return renderSolicitudesView(viewRoot);
  if (page === 'excepciones') return renderExcepcionesView(viewRoot);
  if (page === 'seguimiento') return renderPerformanceView(viewRoot);
  if (page === 'metas') return renderMonthlyGoalsView(viewRoot);
}

function renderToasts() {
  const host = document.getElementById('toast-host');
  if (!host) return;
  host.innerHTML = (getState().ui.toasts || []).map((t) => (
    `<div class="toast toast--${t.type}">${t.message}</div>`
  )).join('');
}

subscribe(renderToasts);

init().catch(console.error);
