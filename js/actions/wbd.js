import { MORNING_WBD_LIMIT } from '../../domain/constants.js';
import { MORNING_WBD_BLOCKS } from '../../domain/blocks.js';
import { activeMorningWbdIds } from '../../domain/morningWbd.js';
import { canAssign } from '../../domain/rules/canAssign.js';
import { getState, buildAssignContext, patchMorningWbdMap } from '../store.js';
import { persistMorningWbdMap } from './persist.js';
import { showError } from '../utils/toast.js';

export async function toggleMorningWbd(day, agentId, checked, weekKey = getState().visibleWeek) {
  const agent = getState().agents.byId[agentId];
  if (!agent) return { ok: false };

  const schedule = getState().schedules[weekKey === 'next' ? 'next' : 'current'];
  const dayPlan = schedule?.days?.[day] || {};
  const map = structuredClone(getState().morningWbdMap);
  map[day] = activeMorningWbdIds(map, day, dayPlan);
  const current = [...(map[day] || [])];

  if (checked) {
    const block = Object.keys(dayPlan).find((key) => (dayPlan[key] || []).includes(agentId));
    if (!block || !MORNING_WBD_BLOCKS.includes(block)) {
      showError(`${agent.name} debe estar en lobby mañana (7AM, 8AM o 9AM) para marcar WBD.`);
      return { ok: false, code: 'WBD_NOT_IN_LOBBY' };
    }
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

export function isMorningWbd(day, agentId, weekKey = getState().visibleWeek) {
  const schedule = getState().schedules[weekKey === 'next' ? 'next' : 'current'];
  const dayPlan = schedule?.days?.[day] || {};
  return activeMorningWbdIds(getState().morningWbdMap, day, dayPlan).includes(agentId);
}

export function showMorningWbdToggle(block) {
  return MORNING_WBD_BLOCKS.includes(block);
}
