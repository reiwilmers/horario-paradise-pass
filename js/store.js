import { DAYS } from '../domain/constants.js';
import { CAPACITY, SALA_BLOCKS, LOBBY_BLOCKS, blockArea } from '../domain/blocks.js';
import { parseAgent, parseMorningWbdMap, parseScheduleWeek } from '../domain/schemas.js';
import { emptyWeekDays, stripUnknownAgents } from '../domain/schedule.js';
import { syncForecastsToCalendar } from '../domain/forecast.js';
import { forecastDateForDay } from '../domain/forecast.js';
import { exceptionBlockFor } from '../domain/exceptions.js';
import { ADMIN_CATEGORIES } from '../domain/constants.js';
import { SEED_DATA } from './seed-data.js';

/** @type {object} */
let state = createInitialState();
/** @type {Set<(s: object) => void>} */
const listeners = new Set();

function createInitialState() {
  return structuredClone({
    agents: { byId: {}, ids: [] },
    schedules: {
      current: { weekKey: 'current', mondayIso: '', days: emptyWeekDays(), updatedAt: '' },
      next: { weekKey: 'next', mondayIso: '', days: emptyWeekDays(), updatedAt: '' },
    },
    forecasts: { current: [], next: [] },
    forecastSettings: { ...SEED_DATA.forecastSettings },
    morningWbdMap: { ...SEED_DATA.morningWbdMap },
    eveningWbdCounts: { ...SEED_DATA.eveningWbdCounts },
    visibleWeek: 'current',
    forecastEditWeek: 'current',
    requests: [],
    exceptions: [],
    ui: { page: 'horario', dragged: null, toasts: [], currentUserId: null },
  });
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

export function loadAgents(rawAgents = []) {
  const byId = {};
  const ids = [];
  for (const raw of rawAgents) {
    const parsed = parseAgent(raw);
    if (!parsed.ok) continue;
    byId[parsed.value.id] = parsed.value;
    ids.push(parsed.value.id);
  }
  state.agents = { byId, ids };
  sanitizeSchedules();
  emit();
}

export function loadSchedule(weekKey, raw) {
  if (!raw) return { ok: false, errors: ['missing schedule'] };
  const validIds = new Set(state.agents.ids);
  const parsed = parseScheduleWeek({ ...raw, weekKey }, validIds);
  if (!parsed.ok) return parsed;
  state.schedules[weekKey] = parsed.value;
  emit();
  return parsed;
}

export function loadForecasts(current = [], next = []) {
  state.forecasts = { current, next };
  emit();
}

export function loadRequests(requests = []) {
  state.requests = requests;
  emit();
}

export function loadExceptions(exceptions = []) {
  state.exceptions = exceptions;
  emit();
}

export function upsertRequest(request) {
  const index = state.requests.findIndex((item) => item.id === request.id);
  if (index >= 0) state.requests[index] = request;
  else state.requests = [request, ...state.requests];
  emit();
  return request;
}

export function upsertException(exception) {
  const index = state.exceptions.findIndex((item) => item.id === exception.id);
  if (index >= 0) state.exceptions[index] = exception;
  else state.exceptions = [exception, ...state.exceptions];
  emit();
  return exception;
}

export function setExceptions(exceptions = []) {
  state.exceptions = exceptions;
  emit();
}

export function setCurrentUserId(userId, silent = false) {
  state.ui.currentUserId = userId || null;
  if (!silent) emit();
}

export function currentUser() {
  const id = state.ui.currentUserId;
  return id ? state.agents.byId[id] : null;
}

export function isAdminUser() {
  const user = currentUser();
  return user ? ADMIN_CATEGORIES.has(user.category) : false;
}

export function patchForecasts(weekKey, rows) {
  const key = weekKey === 'next' ? 'next' : 'current';
  state.forecasts[key] = rows;
  emit();
}

export function patchForecastRow(weekKey, index, patch) {
  const key = weekKey === 'next' ? 'next' : 'current';
  const rows = [...(state.forecasts[key] || [])];
  rows[index] = { ...rows[index], ...patch };
  state.forecasts[key] = rows;
  emit();
  return rows[index];
}

export function patchForecastSettings(settings) {
  state.forecastSettings = { ...state.forecastSettings, ...settings };
  emit();
}

export function syncForecastsInStore(reference = new Date()) {
  const synced = syncForecastsToCalendar(state.forecasts, reference);
  state.forecasts = synced;
  emit();
  return synced;
}

export function hydrateFromDb(payload = {}) {
  if (payload.agents?.length) loadAgents(payload.agents);
  if (payload.schedules?.current) loadSchedule('current', payload.schedules.current);
  if (payload.schedules?.next) loadSchedule('next', payload.schedules.next);
  if (payload.forecasts) loadForecasts(payload.forecasts.current, payload.forecasts.next);
  if (payload.morningWbdMap) loadMorningWbdMap(payload.morningWbdMap);
  if (payload.visibleWeek) setVisibleWeek(payload.visibleWeek);
  if (payload.forecastSettings) state.forecastSettings = payload.forecastSettings;
  if (payload.forecastEditWeek) setForecastEditWeek(payload.forecastEditWeek);
  if (payload.requests) loadRequests(payload.requests);
  if (payload.exceptions) loadExceptions(payload.exceptions);
  if (payload.currentUserId) setCurrentUserId(payload.currentUserId, true);
  if (payload.eveningWbdCounts) state.eveningWbdCounts = payload.eveningWbdCounts;
  emit();
}

export function sanitizeSchedules() {
  const validIds = new Set(state.agents.ids);
  for (const weekKey of ['current', 'next']) {
    const schedule = state.schedules[weekKey];
    schedule.days = stripUnknownAgents(schedule.days, validIds);
  }
}

export function loadMorningWbdMap(raw) {
  const parsed = parseMorningWbdMap(raw);
  if (parsed.ok) state.morningWbdMap = parsed.value;
  emit();
}

export function patchScheduleDays(weekKey, days, extra = {}) {
  state.schedules[weekKey] = {
    ...state.schedules[weekKey],
    days,
    ...extra,
    updatedAt: new Date().toISOString(),
  };
  emit();
}

export function patchMorningWbdMap(map) {
  state.morningWbdMap = map;
  emit();
}

export function setVisibleWeek(weekKey) {
  state.visibleWeek = weekKey === 'next' ? 'next' : 'current';
  emit();
}

export function setForecastEditWeek(weekKey) {
  state.forecastEditWeek = weekKey === 'next' ? 'next' : 'current';
  emit();
}

export function setUiPage(page) {
  state.ui.page = page;
  emit();
}

export function setDragged(dragged, silent = false) {
  state.ui.dragged = dragged;
  if (!silent) emit();
}

export function pushToast(toast) {
  state.ui.toasts = [...state.ui.toasts.slice(-4), { ...toast, id: Date.now() }];
  emit();
}

export function buildAssignContext(day, weekKey = state.visibleWeek, extra = {}) {
  const schedule = state.schedules[weekKey];
  const agentsById = state.agents.byId;
  const forecastRows = state.forecasts[weekKey] || [];
  const date = forecastDateForDay(forecastRows, day);
  return {
    schedule,
    agentsById,
    capacity: CAPACITY,
    day,
    morningWbdMap: state.morningWbdMap,
    isWeekday: (d) => DAYS.indexOf(d) >= 0 && DAYS.indexOf(d) <= 4,
    previousDay: (d) => {
      const i = DAYS.indexOf(d);
      return DAYS[(i + DAYS.length - 1) % DAYS.length];
    },
    countSalaWeek: (agentId) => countAreaWeek(schedule.days, agentId, 'SALA'),
    countLobbyWeek: (agentId) => countAreaWeek(schedule.days, agentId, 'LOBBY'),
    forcedBlockForAgent: (agentId) => exceptionBlockFor(agentId, date, state.exceptions),
    ...extra,
  };
}

function countAreaWeek(days, agentId, area) {
  let count = 0;
  for (const day of DAYS) {
    const dayPlan = days[day];
    if (!dayPlan) continue;
    for (const block of Object.keys(dayPlan)) {
      if (!(dayPlan[block] || []).includes(agentId)) continue;
      const areaName = SALA_BLOCKS.includes(block) ? 'SALA' : LOBBY_BLOCKS.includes(block) ? 'LOBBY' : '';
      if (areaName === area) count += 1;
    }
  }
  return count;
}

export function resetStore() {
  state = createInitialState();
  emit();
}

export function patchAgent(agentId, patch) {
  const current = state.agents.byId[agentId];
  if (!current) return { ok: false, errors: ['agent not found'] };
  const merged = {
    ...current,
    ...patch,
    rules: { ...current.rules, ...(patch.rules || {}) },
    updatedAt: new Date().toISOString(),
  };
  const parsed = parseAgent(merged);
  if (!parsed.ok) return parsed;
  state.agents.byId[agentId] = parsed.value;
  sanitizeSchedules();
  emit();
  return { ok: true, value: parsed.value };
}

export function activeAgents() {
  return state.agents.ids
    .map((id) => state.agents.byId[id])
    .filter((agent) => agent?.active);
}
