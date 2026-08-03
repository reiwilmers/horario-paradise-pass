import { DAYS } from './constants.js';
import { MORNING_WBD_BLOCKS } from './blocks.js';
import { findAgentBlock } from './schedule.js';

/** Agent IDs in morningWbdMap that still sit in a morning-lobby block this day. */
export function pruneMorningWbdForDay(agentIds = [], dayPlan = {}) {
  return agentIds.filter((agentId) => {
    const block = findAgentBlock(dayPlan, agentId);
    return MORNING_WBD_BLOCKS.includes(block);
  });
}

export function activeMorningWbdIds(morningWbdMap = {}, day, dayPlan = {}) {
  return pruneMorningWbdForDay(morningWbdMap[day] || [], dayPlan);
}

export function syncMorningWbdMapWithSchedule(morningWbdMap = {}, scheduleDays = {}) {
  const next = { ...morningWbdMap };
  for (const day of DAYS) {
    next[day] = pruneMorningWbdForDay(next[day] || [], scheduleDays?.[day]);
  }
  return next;
}

/** Drop WBD entries when the agent is not in a morning lobby block in either week. */
export function pruneMorningWbdMapGlobal(morningWbdMap = {}, schedules = {}) {
  const out = { ...morningWbdMap };
  for (const day of DAYS) {
    const ids = out[day] || [];
    out[day] = [...new Set(ids.filter((agentId) => {
      const inCurrent = MORNING_WBD_BLOCKS.includes(
        findAgentBlock(schedules?.current?.days?.[day], agentId),
      );
      const inNext = MORNING_WBD_BLOCKS.includes(
        findAgentBlock(schedules?.next?.days?.[day], agentId),
      );
      return inCurrent || inNext;
    }))];
  }
  return out;
}
