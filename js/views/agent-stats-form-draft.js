import { RATIO_METRICS } from '../../domain/agentSalesStats.js';

const statsFormDraft = {};

function draftKey(agentId, isoDate, suffix) {
  return `${agentId}:${isoDate}:${suffix}`;
}

function metricPrefixes() {
  return ['entry', 'july-month'];
}

export function captureStatsFormDraft(container, agentId, isoDate) {
  if (!container || !agentId || !isoDate) return;
  const root = container.querySelector('[data-agent-stats="1"]');
  if (!root) return;

  for (const prefix of metricPrefixes()) {
    statsFormDraft[draftKey(agentId, isoDate, `${prefix}-certs`)] = (
      root.querySelector(`[data-stats-certs="${prefix}"]`)?.value ?? ''
    );
    for (const metric of RATIO_METRICS) {
      for (let index = 0; index < 3; index += 1) {
        statsFormDraft[draftKey(agentId, isoDate, `${prefix}-${metric}-${index}`)] = (
          root.querySelector(`[data-stats-part="${prefix}-${metric}-${index}"]`)?.value ?? ''
        );
      }
    }
  }
}

export function restoreStatsFormDraft(container, agentId, isoDate) {
  if (!container || !agentId || !isoDate) return;
  const root = container.querySelector('[data-agent-stats="1"]');
  if (!root) return;

  for (const prefix of metricPrefixes()) {
    const certs = root.querySelector(`[data-stats-certs="${prefix}"]`);
    const certsValue = statsFormDraft[draftKey(agentId, isoDate, `${prefix}-certs`)];
    if (certs && certsValue != null) certs.value = certsValue;

    for (const metric of RATIO_METRICS) {
      for (let index = 0; index < 3; index += 1) {
        const input = root.querySelector(`[data-stats-part="${prefix}-${metric}-${index}"]`);
        const value = statsFormDraft[draftKey(agentId, isoDate, `${prefix}-${metric}-${index}`)];
        if (input && value != null) input.value = value;
      }
    }
  }
}

export function statsFormHasDraft(agentId, isoDate) {
  return Object.keys(statsFormDraft).some((key) => key.startsWith(`${agentId}:${isoDate}:`)
    && String(statsFormDraft[key] || '').trim() !== '');
}

export function clearStatsFormDraft(agentId, isoDate) {
  Object.keys(statsFormDraft).forEach((key) => {
    if (key.startsWith(`${agentId}:${isoDate}:`)) delete statsFormDraft[key];
  });
}

export function bindStatsFormDraft(container, agentId, isoDate) {
  const root = container.querySelector('[data-agent-stats="1"]');
  if (!root) return;
  const persist = () => captureStatsFormDraft(container, agentId, isoDate);
  root.querySelectorAll('[data-stats-part], [data-stats-certs]').forEach((input) => {
    input.addEventListener('input', persist);
    input.addEventListener('change', persist);
  });
}
