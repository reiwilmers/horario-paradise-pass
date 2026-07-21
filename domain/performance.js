import { isRequestApproved } from './requests.js';
import { CATEGORIES } from './constants.js';

const CATEGORY_RANK = Object.fromEntries(CATEGORIES.map((category, index) => [category, index]));

export const MONTH_KEYS = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

export const LEVEL_ORDER = ['TOP', 'MA', 'MB'];
export const LEVEL_LOWER = { TOP: 'MA', MA: 'MB' };
export const LEVEL_UPPER = { MB: 'MA', MA: 'TOP' };

export function emptyYearSales() {
  return Object.fromEntries(MONTH_KEYS.map((month) => [month, {}]));
}

export function normalizeSalesTracking(raw = {}, year = new Date().getFullYear()) {
  const yearKey = String(year);
  const byYear = raw?.byYear && typeof raw.byYear === 'object' ? raw.byYear : {};
  const yearData = byYear[yearKey] || {};
  const months = emptyYearSales();
  for (const month of MONTH_KEYS) {
    const monthValues = yearData[month];
    if (monthValues && typeof monthValues === 'object') {
      months[month] = { ...monthValues };
    }
  }
  return {
    year: Number(raw?.year) || year,
    byYear: { ...byYear, [yearKey]: months },
  };
}

export function visibleMonthKeys(reference = new Date(), year = reference.getFullYear()) {
  const nowYear = reference.getFullYear();
  if (year < nowYear) return [...MONTH_KEYS];
  if (year > nowYear) return [];
  return MONTH_KEYS.slice(0, reference.getMonth() + 1);
}

export function monthDateRange(monthKey, year) {
  const index = MONTH_KEYS.indexOf(monthKey);
  if (index < 0) return null;
  return {
    start: new Date(year, index, 1, 12),
    end: new Date(year, index + 1, 0, 12),
  };
}

export function isAgentOnVacationInMonth(agentId, monthKey, year, requests = []) {
  const range = monthDateRange(monthKey, year);
  if (!range) return false;
  return requests.some((request) => {
    if (request.applicantId !== agentId || request.type !== 'Vacaciones') return false;
    if (!isRequestApproved(request)) return false;
    const from = new Date(`${request.from || request.date}T12:00:00`);
    const until = new Date(`${request.until || request.from || request.date}T12:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) return false;
    return from <= range.end && until >= range.start;
  });
}

export function computeMonthStats(monthValues = {}) {
  const entries = Object.entries(monthValues).filter(([, value]) => Number.isFinite(Number(value)));
  if (!entries.length) {
    return { average: 0, min: null, max: null, pctByAgent: {} };
  }

  const numeric = entries.map(([agentId, value]) => [agentId, Number(value)]);
  const values = numeric.map(([, value]) => value);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pctByAgent = Object.fromEntries(
    numeric.map(([agentId, value]) => [
      agentId,
      average ? Math.round(((value - average) / average) * 100) : 0,
    ]),
  );

  return {
    average: Math.round(average * 10) / 10,
    min: values.length > 1 ? min : null,
    max,
    pctByAgent,
  };
}

export function computeCategoryMonthStats(monthValues = {}, agentsById = {}, category, {
  monthKey,
  year,
  requests = [],
} = {}) {
  const filtered = Object.fromEntries(
    Object.entries(monthValues).filter(([agentId, value]) => {
      const agent = agentsById[agentId];
      if (!agent?.active || agent.category !== category) return false;
      if (!Number.isFinite(Number(value))) return false;
      if (monthKey && isAgentOnVacationInMonth(agentId, monthKey, year, requests)) return false;
      return true;
    }).map(([agentId, value]) => [agentId, Number(value)]),
  );
  return computeMonthStats(filtered);
}

export function highlightClass(value, stats) {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  if (stats.max != null && numeric === stats.max) return 'performance-cell--max';
  if (stats.min != null && numeric === stats.min) return 'performance-cell--min';
  return '';
}

function recentPerformanceMonths(agentId, visibleMonths, monthData, year, requests) {
  return visibleMonths.filter((month) => {
    const value = monthData[month]?.[agentId];
    if (!Number.isFinite(Number(value))) return false;
    return !isAgentOnVacationInMonth(agentId, month, year, requests);
  });
}

export function computeAgentLevelInsight(agent, {
  monthData = {},
  visibleMonths = [],
  year = new Date().getFullYear(),
  requests = [],
  agentsById = {},
}) {
  if (!agent || ['SUP', 'GTE'].includes(agent.category)) {
    return { trendLabel: '—', trendClass: '', suggestion: '' };
  }

  const activeMonths = recentPerformanceMonths(agent.id, visibleMonths, monthData, year, requests);
  const categoryStats = activeMonths.map((month) => computeCategoryMonthStats(
    monthData[month] || {},
    agentsById,
    agent.category,
    { monthKey: month, year, requests },
  ));

  const pctSamples = activeMonths.map((month, index) => {
    const value = Number(monthData[month]?.[agent.id]);
    const average = categoryStats[index]?.average || 0;
    if (!average) return 0;
    return Math.round(((value - average) / average) * 100);
  });

  const ytdPct = pctSamples.length
    ? Math.round(pctSamples.reduce((sum, pct) => sum + pct, 0) / pctSamples.length)
    : null;

  let trendLabel = '—';
  let trendClass = 'performance-trend--neutral';
  if (ytdPct != null) {
    if (ytdPct >= 8) {
      trendLabel = `▲ ${ytdPct}% vs ${agent.category}`;
      trendClass = 'performance-trend--up';
    } else if (ytdPct <= -8) {
      trendLabel = `▼ ${Math.abs(ytdPct)}% vs ${agent.category}`;
      trendClass = 'performance-trend--down';
    } else {
      trendLabel = `→ ${ytdPct}% vs ${agent.category}`;
    }
  }

  const recentMonths = activeMonths.slice(-2);
  const recentPcts = recentMonths.map((month) => {
    const stats = computeCategoryMonthStats(
      monthData[month] || {},
      agentsById,
      agent.category,
      { monthKey: month, year, requests },
    );
    const value = Number(monthData[month]?.[agent.id]);
    const average = stats.average || 0;
    if (!average) return 0;
    return ((value - average) / average) * 100;
  });

  let suggestion = '';
  const lowMonths = recentPcts.filter((pct) => pct <= -15).length;
  const highMonths = recentPcts.filter((pct) => pct >= 15).length;

  if (recentMonths.length >= 2 && lowMonths >= 2 && LEVEL_LOWER[agent.category]) {
    suggestion = `Sugerencia: bajar a ${LEVEL_LOWER[agent.category]}`;
  } else if (recentMonths.length >= 2 && highMonths >= 2 && LEVEL_UPPER[agent.category]) {
    suggestion = `Sugerencia: subir a ${LEVEL_UPPER[agent.category]}`;
  }

  return { trendLabel, trendClass, suggestion };
}

export function computeAnnualTotals(agents = [], monthData = {}, visibleMonths = [], year, requests = []) {
  return Object.fromEntries(
    agents.map((agent) => {
      const total = visibleMonths.reduce((sum, month) => {
        if (isAgentOnVacationInMonth(agent.id, month, year, requests)) return sum;
        const value = Number(monthData[month]?.[agent.id]);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      return [agent.id, total];
    }),
  );
}

export function sortAgentsForPerformanceView(agents = [], annualTotals = {}) {
  return [...agents].sort((a, b) => {
    const rankA = CATEGORY_RANK[a.category] ?? 99;
    const rankB = CATEGORY_RANK[b.category] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const totalDiff = (annualTotals[b.id] || 0) - (annualTotals[a.id] || 0);
    if (totalDiff !== 0) return totalDiff;
    return String(a.name).localeCompare(String(b.name), 'es');
  });
}
