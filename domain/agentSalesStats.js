import { formatIsoDate, mondayOfWeek } from './forecast.js';
import { MONTH_KEYS, monthDateRange } from './performance.js';

export const RATIO_METRICS = ['SALA', 'LR', 'OA', 'LG', 'LB'];
export const SALES_METRIC_KEYS = [...RATIO_METRICS, 'Certs'];

export function emptyRatioParts() {
  return [0, 0, 0];
}

export function emptyDailySalesEntry() {
  return {
    SALA: emptyRatioParts(),
    LR: emptyRatioParts(),
    OA: emptyRatioParts(),
    LG: emptyRatioParts(),
    LB: emptyRatioParts(),
    Certs: 0,
    reflection: '',
    scenario: '',
    coachOpenedAt: '',
    coachFeedback: '',
    coachFeedbackAt: '',
  };
}

export function emptyAgentSalesStatsStore(year = new Date().getFullYear()) {
  return { year, byYear: { [String(year)]: {} } };
}

function normalizeRatioParts(raw) {
  if (Array.isArray(raw)) {
    return [
      Math.max(0, Number(raw[0]) || 0),
      Math.max(0, Number(raw[1]) || 0),
      Math.max(0, Number(raw[2]) || 0),
    ];
  }
  if (typeof raw === 'string') {
    const parts = raw.split('/').map((part) => Math.max(0, Number(part.trim()) || 0));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  return emptyRatioParts();
}

export function normalizeDailySalesEntry(raw = {}) {
  const entry = emptyDailySalesEntry();
  for (const metric of RATIO_METRICS) {
    entry[metric] = normalizeRatioParts(raw[metric]);
  }
  entry.Certs = Math.max(0, Number(raw.Certs) || 0);
  entry.reflection = String(raw.reflection || '').trim();
  entry.scenario = ['SALA', 'LOBBY'].includes(raw.scenario) ? raw.scenario : '';
  entry.coachOpenedAt = String(raw.coachOpenedAt || '').trim();
  entry.coachFeedback = String(raw.coachFeedback || '').trim();
  entry.coachFeedbackAt = String(raw.coachFeedbackAt || '').trim();
  return entry;
}

export function normalizeAgentSalesStats(raw = {}, year = new Date().getFullYear()) {
  const yearKey = String(year);
  const byYear = raw?.byYear && typeof raw.byYear === 'object' ? raw.byYear : {};
  const yearData = byYear[yearKey] || {};
  const normalizedYear = {};
  for (const [isoDate, dayAgents] of Object.entries(yearData)) {
    if (!isoDate || typeof dayAgents !== 'object') continue;
    normalizedYear[isoDate] = Object.fromEntries(
      Object.entries(dayAgents).map(([agentId, entry]) => [agentId, normalizeDailySalesEntry(entry)]),
    );
  }
  return {
    year: Number(raw?.year) || year,
    byYear: { ...byYear, [yearKey]: normalizedYear },
  };
}

export function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

export function mondayOfIsoDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatIsoDate(date);
}

export function monthKeyFromIsoDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  return MONTH_KEYS[date.getMonth()] || 'ENE';
}

export function datesInWeek(mondayIso) {
  return Array.from({ length: 7 }, (_, index) => addDaysIso(mondayIso, index));
}

export function datesInMonth(monthKey, year) {
  const range = monthDateRange(monthKey, year);
  if (!range) return [];
  const dates = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    dates.push(formatIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function sumRatioParts(entries, metric) {
  const totals = emptyRatioParts();
  for (const entry of entries) {
    const parts = entry?.[metric] || emptyRatioParts();
    totals[0] += parts[0] || 0;
    totals[1] += parts[1] || 0;
    totals[2] += parts[2] || 0;
  }
  return totals;
}

export function sumCerts(entries) {
  return entries.reduce((total, entry) => total + (Number(entry?.Certs) || 0), 0);
}

export function rollupMetrics(entries) {
  const rollup = emptyDailySalesEntry();
  for (const metric of RATIO_METRICS) {
    rollup[metric] = sumRatioParts(entries, metric);
  }
  rollup.Certs = sumCerts(entries);
  return rollup;
}

export function ratioPercent(parts = []) {
  const base = Number(parts[0]) || 0;
  const second = Number(parts[1]) || 0;
  if (!base) return 0;
  return Math.round((second / base) * 100);
}

export function formatRatioMetric(parts = [], includePercent = true) {
  const values = normalizeRatioParts(parts);
  if (!values[0] && !values[1] && !values[2]) return '';
  const base = `${values[0]}/${values[1]}`;
  const suffix = values[2] ? `/${values[2]}` : '';
  if (!includePercent) return `${base}${suffix}`;
  return `${base}${suffix} ${ratioPercent(values)}%`.trim();
}

export function formatMetricLine(metric, rollup, includePercent = true) {
  if (metric === 'Certs') {
    const value = Number(rollup?.Certs) || 0;
    return value ? String(value) : '';
  }
  return formatRatioMetric(rollup?.[metric], includePercent);
}

export function getDailyEntry(stats, isoDate, agentId) {
  const yearKey = String(stats?.year || new Date(isoDate).getFullYear());
  return normalizeDailySalesEntry(stats?.byYear?.[yearKey]?.[isoDate]?.[agentId] || {});
}

export function collectEntriesForDates(stats, agentId, dates = []) {
  const yearKey = String(stats?.year || new Date().getFullYear());
  const yearData = stats?.byYear?.[yearKey] || {};
  return dates
    .map((isoDate) => yearData?.[isoDate]?.[agentId])
    .filter(Boolean)
    .map((entry) => normalizeDailySalesEntry(entry));
}

export function buildPeriodRollup(stats, agentId, dates = []) {
  return rollupMetrics(collectEntriesForDates(stats, agentId, dates));
}

export function buildAgentStatsSnapshot({
  stats,
  agentId,
  isoDate = formatIsoDate(new Date()),
  goals = {},
  year = stats?.year || new Date().getFullYear(),
}) {
  const monthKey = monthKeyFromIsoDate(isoDate);
  const mondayIso = mondayOfIsoDate(isoDate);
  const day = getDailyEntry(stats, isoDate, agentId);
  const week = buildPeriodRollup(stats, agentId, datesInWeek(mondayIso));
  const month = buildPeriodRollup(stats, agentId, datesInMonth(monthKey, year));
  const certGoal = goals.certGoal ?? null;
  const records = goals.records || emptyRecords();
  const monthCerts = month.Certs || 0;
  const monthRange = monthDateRange(monthKey, year);
  const today = new Date(`${isoDate}T12:00:00`);
  const daysLeft = monthRange
    ? Math.max(1, Math.ceil((monthRange.end.getTime() - today.getTime()) / 86400000) + 1)
    : 1;
  const certsRemaining = certGoal != null ? Math.max(0, certGoal - monthCerts) : null;
  const dailyPaceNeeded = certsRemaining != null ? Math.ceil(certsRemaining / daysLeft) : null;

  return {
    isoDate,
    monthKey,
    day,
    week,
    month,
    certGoal,
    monthCerts,
    certsRemaining,
    dailyPaceNeeded,
    progressPct: certGoal ? Math.min(100, Math.round((monthCerts / certGoal) * 100)) : null,
    records,
    beatRecord: {
      day: compareRecord(day, records.daily),
      week: compareRecord(week, records.weekly),
      month: compareRecord(month, records.monthly),
    },
  };
}

export function emptyRecords() {
  return {
    daily: emptyDailySalesEntry(),
    weekly: emptyDailySalesEntry(),
    monthly: emptyDailySalesEntry(),
  };
}

export function normalizeRecords(raw = {}) {
  return {
    daily: normalizeDailySalesEntry(raw.daily),
    weekly: normalizeDailySalesEntry(raw.weekly),
    monthly: normalizeDailySalesEntry(raw.monthly),
  };
}

function compareRecord(current, record) {
  if (!record) return null;
  const currentCerts = Number(current?.Certs) || 0;
  const recordCerts = Number(record?.Certs) || 0;
  if (!recordCerts) return null;
  if (currentCerts > recordCerts) return 'beat';
  if (currentCerts === recordCerts) return 'tie';
  return 'below';
}

export function formatStatsHeader(agentName, isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDate();
  const month = date.toLocaleString('es-DO', { month: 'short' }).replace('.', '').toUpperCase();
  return `${agentName.toUpperCase()}\n${day} ${month}`;
}

export function buildWhatsAppStatsText({ agentName, snapshot }) {
  const lines = [formatStatsHeader(agentName, snapshot.isoDate), ''];
  for (const label of ['DÍA', 'SEMANA', 'MES']) {
    const rollup = label === 'DÍA' ? snapshot.day : label === 'SEMANA' ? snapshot.week : snapshot.month;
    lines.push(label);
    for (const metric of SALES_METRIC_KEYS) {
      const value = formatMetricLine(metric, rollup, metric !== 'Certs');
      lines.push(`${metric} = ${value}`.trim());
    }
    lines.push('');
  }
  if (snapshot.certGoal) lines.push(`Meta ${snapshot.certGoal}`);
  return lines.join('\n').trim();
}

export function syncMonthlyCertsFromStats(stats, salesTracking, agentId, isoDate) {
  const year = stats?.year || new Date(isoDate).getFullYear();
  const monthKey = monthKeyFromIsoDate(isoDate);
  const monthRollup = buildPeriodRollup(stats, agentId, datesInMonth(monthKey, year));
  const yearKey = String(year);
  const next = normalizeSalesTrackingBridge(salesTracking, year);
  next.byYear[yearKey][monthKey] = {
    ...(next.byYear[yearKey][monthKey] || {}),
    [agentId]: monthRollup.Certs || 0,
  };
  return next;
}

function normalizeSalesTrackingBridge(raw, year) {
  const yearKey = String(year);
  const byYear = raw?.byYear && typeof raw.byYear === 'object' ? raw.byYear : {};
  const months = Object.fromEntries(MONTH_KEYS.map((month) => [month, { ...(byYear[yearKey]?.[month] || {}) }]));
  return { year: Number(raw?.year) || year, byYear: { ...byYear, [yearKey]: months } };
}

export function defaultStatsDate(reference = new Date()) {
  return formatIsoDate(reference);
}

export function calendarContext(reference = new Date()) {
  return {
    todayIso: formatIsoDate(reference),
    weekMondayIso: formatIsoDate(mondayOfWeek(reference)),
  };
}

export const JULY_BULK_CATCHUP = { month: 'JUL', year: 2026 };

export function isJulyBulkCatchupActive(reference = new Date()) {
  return reference.getFullYear() === JULY_BULK_CATCHUP.year
    && reference.getMonth() === 6;
}

export function entryHasSalesData(entry = {}) {
  if (Number(entry.Certs) > 0) return true;
  return RATIO_METRICS.some((metric) => (entry[metric] || []).some((value) => Number(value) > 0));
}

export function buildBulkRowEntry(raw = {}) {
  const entry = emptyDailySalesEntry();
  for (const metric of RATIO_METRICS) {
    entry[metric] = normalizeRatioParts(raw[metric]);
  }
  entry.Certs = Math.max(0, Number(raw.Certs) || 0);
  return entry;
}
