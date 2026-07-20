import { ASSIGNABLE_BLOCKS, MORNING_WBD_BLOCKS } from '../../domain/blocks.js';
import { canAssign } from '../../domain/rules/canAssign.js';
import {
  addAgentToBlock,
  findAgentBlock,
  removeAgentFromDay,
} from '../../domain/schedule.js';
import { getState, buildAssignContext, patchScheduleDays, setDragged } from '../store.js';
import { persistSchedule, persistMorningWbdMap } from './persist.js';
import { untoggleMorningWbd } from './wbd.js';
import { showError } from '../utils/toast.js';

function cloneDays(weekKey) {
  return structuredClone(getState().schedules[weekKey].days);
}

export async function placeAgent(weekKey, day, block, agentId, source = null) {
  const agent = getState().agents.byId[agentId];
  if (!agent?.active) {
    showError('Agente invalido o inactivo.');
    return { ok: false, code: 'INVALID_AGENT' };
  }

  const days = cloneDays(weekKey);
  const dayPlan = days[day];
  if (dayPlan[block]?.includes(agentId)) return { ok: true };

  const previewSchedule = {
    ...getState().schedules[weekKey],
    days: structuredClone(days),
  };

  if (source?.day === day && source?.block) {
    previewSchedule.days[day] = removeAgentFromDay(previewSchedule.days[day], agentId);
  } else {
    const appearsElsewhere = ASSIGNABLE_BLOCKS.some((b) => (dayPlan[b] || []).includes(agentId));
    if (appearsElsewhere) {
      const move = window.confirm(`${agent.name} ya está en ${day}. ¿Moverlo a ${block}?`);
      if (!move) return { ok: false, code: 'CANCELLED' };
      previewSchedule.days[day] = removeAgentFromDay(previewSchedule.days[day], agentId);
    }
  }

  const check = canAssign(agent, block, day, buildAssignContext(day, weekKey, {
    schedule: previewSchedule,
    allowSameAgent: false,
  }));
  if (!check.ok) {
    showError(check.message);
    return check;
  }

  let nextDay = previewSchedule.days[day];
  if (source?.day === day && source?.block) {
    nextDay[source.block] = nextDay[source.block].filter((id) => id !== agentId);
  }
  const added = addAgentToBlock(nextDay, block, agentId);
  if (!added) {
    showError(`No hay espacio en ${block}.`);
    return { ok: false, code: 'CAPACITY_FULL' };
  }
  days[day] = added;
  patchScheduleDays(weekKey, days);
  await persistSchedule(weekKey);
  return { ok: true };
}

export async function removeAgent(weekKey, day, block, agentId) {
  const days = cloneDays(weekKey);
  days[day][block] = (days[day][block] || []).filter((id) => id !== agentId);
  if (MORNING_WBD_BLOCKS.includes(block)) {
    await untoggleMorningWbd(day, agentId, { persist: false });
  }
  patchScheduleDays(weekKey, days);
  await persistSchedule(weekKey);
  if (MORNING_WBD_BLOCKS.includes(block)) {
    await persistMorningWbdMap();
  }
  return { ok: true };
}

export async function moveAgent(weekKey, day, block, dragged) {
  if (!dragged?.agentId) return { ok: false };
  const result = await placeAgent(weekKey, day, block, dragged.agentId, dragged);
  setDragged(null);
  return result;
}

export function startDrag(weekKey, day, block, agentId) {
  setDragged({ weekKey, day, block, agentId }, true);
}

export function endDrag() {
  setDragged(null, true);
}

export function agentBlockOnDay(weekKey, day, agentId) {
  return findAgentBlock(getState().schedules[weekKey].days[day], agentId);
}
