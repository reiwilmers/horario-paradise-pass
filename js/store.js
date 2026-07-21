import { DAYS } from '../domain/constants.js';
import { CAPACITY, SALA_BLOCKS, LOBBY_BLOCKS, blockArea } from '../domain/blocks.js';
import { parseAgent, parseMorningWbdMap, parseScheduleWeek } from '../domain/schemas.js';
import { emptyWeekDays, stripUnknownAgents } from '../domain/schedule.js';
import { syncForecastsToCalendar } from '../domain/forecast.js';
import { forecastDateForDay } from '../domain/forecast.js';
import { exceptionBlockFor } from '../domain/exceptions.js';
import { KNOWN_GTE_AGENT_IDS, isAdminAgent } from '../domain/constants.js';
import { normalizeSalesTracking } from '../domain/performance.js';
import { normalizeMonthlyGoals } from '../domain/monthlyGoals.js';
import { normalizeDistributionSnapshots } from '../domain/monthlyDistribution.js';
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
    salesTracking: normalizeSalesTracking(),
    monthlyGoals: normalizeMonthlyGoals(),
    distributionSnapshots: {},
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
    if (KNOWN_GTE_AGENT_IDS.has(parsed.value.id)) {
      parsed.value.category = 'GTE';
      parsed.value.morningWbdEligible = false;
      parsed.value.eveningWbdEligible = false;
    }
    byId[parsed.value.id] = parsed.value;
    ids.push(parsed.value.id);
  }
  state.agents = { byId, ids };
  sanitizeSchedules();
  emit();
}

export function addAgentRecord(agent) {
  const parsed = parseAgent(agent);
  if (!parsed.ok) return parsed;
  if (state.agents.byId[parsed.value.id]) {
    return { ok: false, errors: ['agent already exists'] };
  }
  state.agents.byId[parsed.value.id] = parsed.value;
  state.agents.ids.push(parsed.value.id);
  sanitizeSchedules();
  emit();
  return { ok: true, value: parsed.value };
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

export function loadSalesTracking(raw) {
  state.salesTracking = normalizeSalesTracking(raw, raw?.year || new Date().getFullYear());
  emit();
}

export function patchSalesValue(month, agentId, value) {
  const yearKey = String(state.salesTracking.year);
  const months = { ...(state.salesTracking.byYear[yearKey] || {}) };
  const monthValues = { ...(months[month] || {}) };
  if (value == null || value === '') delete monthValues[agentId];
  else monthValues[agentId] = value;
  months[month] = monthValues;
  state.salesTracking = {
    ...state.salesTracking,
    byYear: { ...state.salesTracking.byYear, [yearKey]: months },
  };
  emit();
}

export function loadMonthlyGoals(raw) {
  state.monthlyGoals = normalizeMonthlyGoals(raw, raw?.year || new Date().getFullYear());
  emit();
}

export function loadDistributionSnapshots(raw) {
  state.distributionSnapshots = normalizeDistributionSnapshots(raw);
  emit();
}

export function upsertDistributionSnapshot(mondayIso, snapshot) {
  if (!mondayIso || !snapshot) return;
  state.distributionSnapshots = {
    ...state.distributionSnapshots,
    [mondayIso]: snapshot,
  };
  emit();
}

export function patchAgentMonthGoals(agentId, month, patch) {
  const yearKey = String(state.monthlyGoals.year);
  const months = { ...(state.monthlyGoals.byYear[yearKey] || {}) };
  const monthAgents = { ...(months[month] || {}) };
  const current = monthAgents[agentId] || {};
  monthAgents[agentId] = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  months[month] = monthAgents;
  state.monthlyGoals = {
    ...state.monthlyGoals,
    byYear: { ...state.monthlyGoals.byYear, [yearKey]: months },
  };
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
  return isAdminAgent(currentUser());
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
  if (payload.salesTracking) loadSalesTracking(payload.salesTracking);
  if (payload.monthlyGoals) loadMonthlyGoals(payload.monthlyGoals);
  if (payload.distributionSnapshots) loadDistributionSnapshots(payload.distributionSnapshots);
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
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  state.ui.toasts = [...state.ui.toasts.slice(-2), { ...toast, id }];
  emit();
  return id;
}

export function dismissToast(id) {
  state.ui.toasts = state.ui.toasts.filter((item) => item.id !== id);
  emit();
}

export function clearToasts() {
  if (!state.ui.toasts.length) return;
  state.ui.toasts = [];
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
