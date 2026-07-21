import { DAYS } from './constants.js';
import { SALA_BLOCKS, LOBBY_BLOCKS, OPENING_LOBBY_BLOCK } from './blocks.js';
import { findAgentBlock } from './schedule.js';
import { isAgentOnVacationOnDate } from './vacations.js';

const CIERRE_SALA = 'Cierre Sala';
const CIERRE_LOBBY = 'Cierre Lobby';

export function emptyAgentMetrics(agentId = '') {
  return {
    agentId,
    sala: 0,
    lobby: 0,
    cierreSala: 0,
    cierreLobby: 0,
    cierre: 0,
    abre: 0,
    wbdMorning: 0,
    wbdEvening: 0,
    posibleOff: 0,
    off: 0,
    vacation: 0,
    assignedDays: 0,
  };
}

export function monthKeyFromDate(isoDate = '') {
  return String(isoDate || '').slice(0, 7);
}

export function currentMonthKey(reference = new Date()) {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function monthKeyLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '—';
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1, 12);
  const label = date.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonthKey(monthKey, delta = 0) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1, 12);
  return currentMonthKey(date);
}

export function weekOverlapsMonth(mondayIso, monthKey) {
  if (!mondayIso || !monthKey) return false;
  const start = new Date(`${mondayIso}T12:00:00`);
  if (Number.isNaN(start.getTime())) return false;
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    if (currentMonthKey(day) === monthKey) return true;
  }
  return false;
}

export function incrementMetricsFromBlock(metrics, block) {
  if (!block) return;
  metrics.assignedDays += 1;
  if (SALA_BLOCKS.includes(block) && block !== CIERRE_SALA) metrics.sala += 1;
  if (LOBBY_BLOCKS.includes(block) && ![CIERRE_LOBBY, 'WBD 5:30PM'].includes(block)) metrics.lobby += 1;
  if (block === 'Posible Off') metrics.posibleOff += 1;
  if (block === 'Off') metrics.off += 1;
  if (block === CIERRE_SALA) metrics.cierreSala += 1;
  if (block === OPENING_LOBBY_BLOCK) metrics.abre += 1;
  if (block === CIERRE_LOBBY) metrics.cierreLobby += 1;
  if (block === 'WBD 5:30PM') metrics.wbdEvening += 1;
  metrics.cierre = metrics.cierreSala + metrics.cierreLobby;
}

export function accumulateWeekIntoMonth(byAgent, {
  monthKey,
  scheduleDays,
  forecastRows,
  morningWbdMap,
  agentsById,
  exceptions,
}) {
  for (const agentId of Object.keys(agentsById)) {
    const agent = agentsById[agentId];
    if (!agent?.active) continue;
    if (!byAgent[agentId]) byAgent[agentId] = emptyAgentMetrics(agentId);

    DAYS.forEach((day, index) => {
      const date = forecastRows[index]?.date || '';
      if (monthKeyFromDate(date) !== monthKey) return;

      const metrics = byAgent[agentId];
      if (isAgentOnVacationOnDate(agentId, date, exceptions)) {
        metrics.vacation += 1;
        return;
      }

      const block = findAgentBlock(scheduleDays[day] || {}, agentId);
      if ((morningWbdMap[day] || []).includes(agentId)) {
        metrics.wbdMorning += 1;
      }
      incrementMetricsFromBlock(metrics, block);
    });
  }
}

export function buildWeekSnapshot({ mondayIso, scheduleDays, forecastRows, morningWbdMap }) {
  return {
    mondayIso,
    scheduleDays: structuredClone(scheduleDays),
    forecastRows: structuredClone(forecastRows || []),
    morningWbdMap: structuredClone(morningWbdMap || {}),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeDistributionSnapshots(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};
  const next = {};
  for (const [mondayIso, snapshot] of Object.entries(raw)) {
    if (!snapshot?.scheduleDays || !Array.isArray(snapshot.forecastRows)) continue;
    next[mondayIso] = {
      mondayIso,
      scheduleDays: snapshot.scheduleDays,
      forecastRows: snapshot.forecastRows,
      morningWbdMap: snapshot.morningWbdMap || {},
      updatedAt: snapshot.updatedAt || new Date().toISOString(),
    };
  }
  return next;
}

export function listAvailableMonthKeys(snapshots = {}, reference = new Date()) {
  const keys = new Set([currentMonthKey(reference)]);
  for (const snapshot of Object.values(snapshots)) {
    for (const row of snapshot.forecastRows || []) {
      const key = monthKeyFromDate(row.date);
      if (key) keys.add(key);
    }
  }
  return [...keys].sort();
}

function weekStartFromForecast(forecastRows = []) {
  const first = forecastRows[0]?.date;
  if (!first) return '';
  const date = new Date(`${first}T12:00:00`);
  if (Number.isNaN(date.getTime())) return first;
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function aggregateMonthlyDistribution(monthKey, {
  snapshots = {},
  schedules = {},
  forecasts = {},
  morningWbdMap = {},
  agentsById = {},
  exceptions = [],
} = {}) {
  const byAgent = {};
  const seenWeeks = new Set();

  const ingestWeek = (mondayIso, scheduleDays, forecastRows, wbdMap) => {
    if (!mondayIso || seenWeeks.has(mondayIso)) return;
    if (!weekOverlapsMonth(mondayIso, monthKey)) return;
    seenWeeks.add(mondayIso);
    accumulateWeekIntoMonth(byAgent, {
      monthKey,
      scheduleDays,
      forecastRows,
      morningWbdMap: wbdMap,
      agentsById,
      exceptions,
    });
  };

  for (const [mondayIso, snapshot] of Object.entries(snapshots)) {
    ingestWeek(mondayIso, snapshot.scheduleDays, snapshot.forecastRows, snapshot.morningWbdMap);
  }

  for (const weekKey of ['current', 'next']) {
    const forecast = forecasts[weekKey] || [];
    const mondayIso = weekStartFromForecast(forecast);
    if (!mondayIso || snapshots[mondayIso]) continue;
    const schedule = schedules[weekKey];
    if (!schedule?.days) continue;
    ingestWeek(mondayIso, schedule.days, forecast, morningWbdMap);
  }

  return Object.values(byAgent)
    .map((metrics) => ({
      ...metrics,
      agent: agentsById[metrics.agentId],
    }))
    .filter((row) => row.agent?.active)
    .sort((a, b) => {
      const rank = { TOP: 1, MA: 2, MB: 3, SUP: 4, GTE: 5 };
      const diff = (rank[a.agent.category] || 9) - (rank[b.agent.category] || 9);
      return diff || a.agent.name.localeCompare(b.agent.name, 'es');
    });
}

export function snapshotFromLiveWeek(state, weekKey) {
  const forecast = state.forecasts[weekKey] || [];
  const mondayIso = weekStartFromForecast(forecast);
  if (!mondayIso) return null;
  const schedule = state.schedules[weekKey];
  if (!schedule?.days) return null;
  return buildWeekSnapshot({
    mondayIso,
    scheduleDays: schedule.days,
    forecastRows: forecast,
    morningWbdMap: state.morningWbdMap,
  });
}

export function countWeeksInMonth(monthKey, snapshots = {}, forecasts = {}) {
  const weeks = new Set();
  for (const mondayIso of Object.keys(snapshots)) {
    if (weekOverlapsMonth(mondayIso, monthKey)) weeks.add(mondayIso);
  }
  for (const weekKey of ['current', 'next']) {
    const mondayIso = weekStartFromForecast(forecasts[weekKey] || []);
    if (mondayIso && weekOverlapsMonth(mondayIso, monthKey)) weeks.add(mondayIso);
  }
  return weeks.size;
}
