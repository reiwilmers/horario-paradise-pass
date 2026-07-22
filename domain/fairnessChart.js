/** Monthly fairness chart — agent totals vs team average (sala / lobby / off / vacation). */

export const FAIRNESS_METRICS = [
  { key: 'sala', label: 'Sala' },
  { key: 'lobby', label: 'Lobby' },
  { key: 'off', label: 'Off' },
  { key: 'vacation', label: 'Vacaciones' },
];

export function fairnessDeviationThreshold(average) {
  return Math.max(2, Math.ceil(Number(average) * 0.2));
}

export function fairnessTone(delta, average) {
  const threshold = fairnessDeviationThreshold(average);
  if (delta >= threshold) return 'high';
  if (delta <= -threshold) return 'low';
  return 'neutral';
}

export function formatFairnessDelta(delta) {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return '±0';
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function activeMonthlyRows(rows = []) {
  return rows.filter((row) => row.assignedDays > 0 || row.vacation > 0);
}

function metricAverage(rows, key) {
  if (!rows.length) return 0;
  const sum = rows.reduce((total, row) => total + (row[key] || 0), 0);
  return sum / rows.length;
}

export function computeFairnessChart(monthRows = []) {
  const activeRows = activeMonthlyRows(monthRows);
  const averages = Object.fromEntries(
    FAIRNESS_METRICS.map(({ key }) => [key, metricAverage(activeRows, key)]),
  );

  const metricSections = FAIRNESS_METRICS.map(({ key, label }) => {
    const average = averages[key];
    const maxValue = activeRows.reduce(
      (max, row) => Math.max(max, row[key] || 0, average),
      average,
    );
    const scaleMax = Math.max(maxValue, 1);

    const rows = activeRows.map((row) => {
      const value = row[key] || 0;
      const delta = value - average;
      return {
        agentId: row.agentId,
        agent: row.agent,
        value,
        average,
        delta,
        tone: fairnessTone(delta, average),
        barWidthPct: Math.round((value / scaleMax) * 100),
        avgMarkerPct: Math.round((average / scaleMax) * 100),
      };
    }).sort((a, b) => b.value - a.value || a.agent.name.localeCompare(b.agent.name, 'es'));

    return { key, label, average, scaleMax, rows };
  });

  return {
    agentCount: activeRows.length,
    averages,
    metricSections,
    hasData: activeRows.length > 0,
  };
}
