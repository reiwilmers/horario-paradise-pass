import { getState, patchAgent } from '../store.js';
import * as db from '../db.js';
import { showError, showSuccess } from '../utils/toast.js';

export async function saveAgent(agentId, patch) {
  const result = patchAgent(agentId, patch);
  if (!result.ok) {
    showError(result.errors?.join(', ') || 'No se pudo guardar el agente.');
    return result;
  }
  await db.put('agents', getState().agents.byId[agentId]);
  showSuccess(`${getState().agents.byId[agentId].name} actualizado.`);
  return result;
}

export async function setAgentCategory(agentId, category) {
  return saveAgent(agentId, { category });
}

export async function setAgentWbdFlags(agentId, flags) {
  return saveAgent(agentId, flags);
}

export async function setAgentRules(agentId, rulesPatch) {
  const agent = getState().agents.byId[agentId];
  if (!agent) return { ok: false, errors: ['agent not found'] };
  return saveAgent(agentId, { rules: { ...agent.rules, ...rulesPatch } });
}

export async function setAgentCollaboratorNumber(agentId, collaboratorNumber) {
  return saveAgent(agentId, { collaboratorNumber: String(collaboratorNumber || '').trim() });
}

export async function setAgentActive(agentId, active) {
  return saveAgent(agentId, { active: Boolean(active) });
}
