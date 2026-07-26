import { RATIO_METRICS } from '../../domain/agentSalesStats.js';

const statsFormDraft = {};

function draftKey(agentId, isoDate, suffix) {
  return `${agentId}:${isoDate}:${suffix}`;
}

export function captureStatsFormDraft(container, agentId, isoDate) {
  if (!container || !agentId || !isoDate) return;
  const root = container.querySelector('[data-agent-stats="1"]');
  if (!root) return;

  statsFormDraft[draftKey(agentId, isoDate, 'reflection')] = (
    root.querySelector('[data-stats-reflection="1"]')?.value ?? ''
  );
  statsFormDraft[draftKey(agentId, isoDate, 'scenario')] = (
    root.querySelector('[data-stats-scenario="1"]')?.value ?? ''
  );
  statsFormDraft[draftKey(agentId, isoDate, 'certs')] = (
    root.querySelector('[data-stats-certs="entry"]')?.value ?? ''
  );

  for (const metric of RATIO_METRICS) {
    for (let index = 0; index < 3; index += 1) {
      statsFormDraft[draftKey(agentId, isoDate, `${metric}-${index}`)] = (
        root.querySelector(`[data-stats-part="entry-${metric}-${index}"]`)?.value ?? ''
      );
    }
  }
}

export function restoreStatsFormDraft(container, agentId, isoDate) {
  if (!container || !agentId || !isoDate) return;
  const root = container.querySelector('[data-agent-stats="1"]');
  if (!root) return;

  const reflection = root.querySelector('[data-stats-reflection="1"]');
  const scenario = root.querySelector('[data-stats-scenario="1"]');
  const certs = root.querySelector('[data-stats-certs="entry"]');
  const reflectionValue = statsFormDraft[draftKey(agentId, isoDate, 'reflection')];
  const scenarioValue = statsFormDraft[draftKey(agentId, isoDate, 'scenario')];
  const certsValue = statsFormDraft[draftKey(agentId, isoDate, 'certs')];

  if (reflection && reflectionValue != null) reflection.value = reflectionValue;
  if (scenario && scenarioValue != null) scenario.value = scenarioValue;
  if (certs && certsValue != null) certs.value = certsValue;

  for (const metric of RATIO_METRICS) {
    for (let index = 0; index < 3; index += 1) {
      const input = root.querySelector(`[data-stats-part="entry-${metric}-${index}"]`);
      const value = statsFormDraft[draftKey(agentId, isoDate, `${metric}-${index}`)];
      if (input && value != null) input.value = value;
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
  root.querySelectorAll('[data-stats-part], [data-stats-certs], [data-stats-reflection], [data-stats-scenario]').forEach((input) => {
    input.addEventListener('input', persist);
    input.addEventListener('change', persist);
  });
}
