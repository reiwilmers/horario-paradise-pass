export const MONTH_KEYS = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
];

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

export function highlightClass(value, stats) {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  if (stats.max != null && numeric === stats.max) return 'performance-cell--max';
  if (stats.min != null && numeric === stats.min) return 'performance-cell--min';
  return '';
}
