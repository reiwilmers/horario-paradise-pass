import { getState, patchAgentMonthGoals } from '../store.js';
import { persistMonthlyGoals } from './persist.js';
import { showSuccess } from '../utils/toast.js';

export async function saveAgentMonthGoals(agentId, month, patch) {
  patchAgentMonthGoals(agentId, month, patch);
  await persistMonthlyGoals();
  const agent = getState().agents.byId[agentId];
  showSuccess(`Metas de ${agent?.name || 'agente'} (${month}) guardadas.`);
  return { ok: true };
}

export async function updateCommitmentActual(agentId, month, index, actual) {
  const yearKey = String(getState().monthlyGoals.year);
  const current = getState().monthlyGoals.byYear[yearKey]?.[month]?.[agentId];
  const commitments = [...(current?.commitments || [])];
  while (commitments.length < 3) commitments.push({ label: '', target: null, actual: null });
  commitments[index] = {
    ...commitments[index],
    actual: actual == null || actual === '' ? null : Number(actual),
  };
  patchAgentMonthGoals(agentId, month, { commitments });
  await persistMonthlyGoals();
  return { ok: true };
}
