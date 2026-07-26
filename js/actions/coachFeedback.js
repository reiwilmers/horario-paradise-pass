import { buildAgentStatsSnapshot } from '../../domain/agentSalesStats.js';
import { getAgentMonthGoals } from '../../domain/monthlyGoals.js';
import { monthKeyFromIsoDate, normalizeDailySalesEntry } from '../../domain/agentSalesStats.js';
import { getState, patchAgentDailySales } from '../store.js';
import { persistAgentSalesStats } from './persist.js';
import { showSuccess } from '../utils/toast.js';

export async function requestCoachFeedback(agentId, isoDate, { reflection, scenario, entry }) {
  const state = getState();
  const agent = state.agents.byId[agentId];
  const goals = getAgentMonthGoals(
    state.monthlyGoals,
    state.monthlyGoals.year,
    monthKeyFromIsoDate(isoDate),
    agentId,
  );
  const snapshot = buildAgentStatsSnapshot({
    stats: state.agentSalesStats,
    agentId,
    isoDate,
    goals,
    year: state.agentSalesStats.year,
  });

  const response = await fetch('/api/coach-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentName: agent?.name || 'Vendedor',
      isoDate,
      reflection,
      scenario,
      snapshot: {
        day: snapshot.day,
        week: snapshot.week,
        month: snapshot.month,
        certGoal: snapshot.certGoal,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'No se pudo obtener feedback del Coach.');
  }

  const nextEntry = normalizeDailySalesEntry({
    ...entry,
    reflection,
    scenario,
    coachFeedback: payload.feedback,
    coachFeedbackAt: payload.generatedAt || new Date().toISOString(),
    coachOpenedAt: payload.generatedAt || new Date().toISOString(),
  });
  patchAgentDailySales(isoDate, agentId, nextEntry);
  await persistAgentSalesStats();
  showSuccess('Feedback del Coach listo. Toma screenshot y compártelo en WhatsApp Stats.');
  return { ok: true, entry: nextEntry, feedback: payload.feedback };
}

export async function saveAgentReflection(agentId, isoDate, entry) {
  patchAgentDailySales(isoDate, agentId, normalizeDailySalesEntry(entry));
  await persistAgentSalesStats();
  showSuccess('Reflexión guardada.');
  return { ok: true };
}
