import { MONTH_KEYS } from './performance.js';

export const GOAL_TRACKING_START_MONTH = 'AGO';
export const COMMITMENT_SLOTS = 3;
export const OPPORTUNITY_SLOTS = 3;

const START_INDEX = MONTH_KEYS.indexOf(GOAL_TRACKING_START_MONTH);

export function emptyCommitment() {
  return { label: '', target: null, actual: null };
}

export function emptyAgentMonthGoals() {
  return {
    certGoal: null,
    commitments: Array.from({ length: COMMITMENT_SLOTS }, () => emptyCommitment()),
    opportunities: Array.from({ length: OPPORTUNITY_SLOTS }, () => ''),
    updatedAt: '',
  };
}

function normalizeCommitments(raw = []) {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: COMMITMENT_SLOTS }, (_, index) => {
    const item = list[index] || {};
    const target = Number(item.target);
    const actual = Number(item.actual);
    return {
      label: String(item.label || '').trim(),
      target: Number.isFinite(target) && target > 0 ? target : null,
      actual: Number.isFinite(actual) && actual >= 0 ? actual : null,
    };
  });
}

function normalizeOpportunities(raw = []) {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: OPPORTUNITY_SLOTS }, (_, index) => String(list[index] || '').trim());
}

export function normalizeAgentMonthGoals(raw = {}) {
  const certGoal = Number(raw.certGoal);
  return {
    certGoal: Number.isFinite(certGoal) && certGoal > 0 ? certGoal : null,
    commitments: normalizeCommitments(raw.commitments),
    opportunities: normalizeOpportunities(raw.opportunities),
    updatedAt: String(raw.updatedAt || ''),
  };
}

export function emptyYearGoals() {
  return Object.fromEntries(MONTH_KEYS.map((month) => [month, {}]));
}

export function normalizeMonthlyGoals(raw = {}, year = new Date().getFullYear()) {
  const yearKey = String(year);
  const byYear = raw?.byYear && typeof raw.byYear === 'object' ? raw.byYear : {};
  const yearData = byYear[yearKey] || {};
  const months = emptyYearGoals();
  for (const month of MONTH_KEYS) {
    const monthAgents = yearData[month];
    if (!monthAgents || typeof monthAgents !== 'object') continue;
    months[month] = Object.fromEntries(
      Object.entries(monthAgents).map(([agentId, record]) => [agentId, normalizeAgentMonthGoals(record)]),
    );
  }
  return {
    year: Number(raw?.year) || year,
    byYear: { ...byYear, [yearKey]: months },
  };
}

export function goalTrackingMonthKeys(reference = new Date(), year = reference.getFullYear()) {
  if (START_INDEX < 0) return [];
  const nowYear = reference.getFullYear();
  if (year < nowYear) return MONTH_KEYS.slice(START_INDEX);
  if (year > nowYear) return [];
  const currentIdx = reference.getMonth();
  if (currentIdx < START_INDEX) return [GOAL_TRACKING_START_MONTH];
  return MONTH_KEYS.slice(START_INDEX, currentIdx + 1);
}

export function computeProgress(actual, target) {
  const numericActual = Number(actual);
  const numericTarget = Number(target);
  if (!Number.isFinite(numericTarget) || numericTarget <= 0) return null;
  if (!Number.isFinite(numericActual) || numericActual < 0) return 0;
  return Math.min(100, Math.round((numericActual / numericTarget) * 100));
}

export function getAgentMonthGoals(monthlyGoals, year, month, agentId) {
  const yearKey = String(year);
  const record = monthlyGoals?.byYear?.[yearKey]?.[month]?.[agentId];
  return normalizeAgentMonthGoals(record || {});
}

export function buildMeasurableItems(record, certActual) {
  const items = [];
  if (record.certGoal) {
    items.push({
      id: 'cert',
      label: 'Certificados mensuales',
      target: record.certGoal,
      actual: Number.isFinite(Number(certActual)) ? Number(certActual) : 0,
      progress: computeProgress(certActual, record.certGoal),
      auto: true,
    });
  }
  record.commitments.forEach((commitment, index) => {
    if (!commitment.label || !commitment.target) return;
    items.push({
      id: `commitment-${index}`,
      label: commitment.label,
      target: commitment.target,
      actual: commitment.actual ?? 0,
      progress: computeProgress(commitment.actual, commitment.target),
      auto: false,
    });
  });
  return items;
}

export function computeMonthCompletion(record, certActual) {
  const items = buildMeasurableItems(record, certActual);
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + (item.progress ?? 0), 0);
  return Math.round(total / items.length);
}

export function computeAnnualGoalSummary(monthlyGoals, year, agentId, months, certActualByMonth = {}) {
  const monthSummaries = months.map((month) => {
    const record = getAgentMonthGoals(monthlyGoals, year, month, agentId);
    const certActual = certActualByMonth[month];
    const completion = computeMonthCompletion(record, certActual);
    return { month, completion, record };
  }).filter((entry) => entry.completion != null);

  if (!monthSummaries.length) {
    return { average: null, months: monthSummaries };
  }

  const average = Math.round(
    monthSummaries.reduce((sum, entry) => sum + entry.completion, 0) / monthSummaries.length,
  );
  return { average, months: monthSummaries };
}

export function progressTone(progress) {
  if (progress == null) return 'neutral';
  if (progress >= 100) return 'complete';
  if (progress >= 70) return 'good';
  if (progress >= 40) return 'mid';
  return 'low';
}
