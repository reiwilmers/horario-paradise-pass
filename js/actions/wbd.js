import { MORNING_WBD_LIMIT } from '../../domain/constants.js';
import { MORNING_WBD_BLOCKS } from '../../domain/blocks.js';
import { canAssign } from '../../domain/rules/canAssign.js';
import { getState, buildAssignContext, patchMorningWbdMap } from '../store.js';
import { persistMorningWbdMap } from './persist.js';
import { showError } from '../utils/toast.js';

export async function toggleMorningWbd(day, agentId, checked, weekKey = getState().visibleWeek) {
  const agent = getState().agents.byId[agentId];
  if (!agent) return { ok: false };

  const map = structuredClone(getState().morningWbdMap);
  const current = [...(map[day] || [])];

  if (checked) {
    const check = canAssign(agent, '9AM', day, buildAssignContext(day, weekKey, {
      morningWbdCheck: true,
      morningWbdMap: map,
      allowSameAgent: true,
    }));
    if (!check.ok) {
      showError(check.message);
      return check;
    }
    if (!current.includes(agentId)) {
      if (current.length >= MORNING_WBD_LIMIT) {
        showError(`Este dia ya tiene ${MORNING_WBD_LIMIT} WBD mañana.`);
        return { ok: false, code: 'MORNING_WBD_LIMIT' };
      }
      current.push(agentId);
    }
  } else {
    const index = current.indexOf(agentId);
    if (index >= 0) current.splice(index, 1);
  }

  map[day] = current;
  patchMorningWbdMap(map);
  await persistMorningWbdMap();
  return { ok: true };
}

export async function untoggleMorningWbd(day, agentId, { persist = true } = {}) {
  const map = structuredClone(getState().morningWbdMap);
  map[day] = (map[day] || []).filter((id) => id !== agentId);
  patchMorningWbdMap(map);
  if (persist) await persistMorningWbdMap();
}

export function isMorningWbd(day, agentId) {
  return (getState().morningWbdMap[day] || []).includes(agentId);
}

export function showMorningWbdToggle(block) {
  return MORNING_WBD_BLOCKS.includes(block);
}
