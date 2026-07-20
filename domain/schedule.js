import { DAYS } from './constants.js';
import { ASSIGNABLE_BLOCKS, CAPACITY } from './blocks.js';
import { parseDayPlan } from './schemas.js';

export function emptyDayPlan() {
  return Object.fromEntries(ASSIGNABLE_BLOCKS.map((block) => [block, []]));
}

export function emptyWeekDays() {
  return Object.fromEntries(DAYS.map((day) => [day, emptyDayPlan()]));
}

export function findAgentBlock(dayPlan, agentId) {
  return ASSIGNABLE_BLOCKS.find((block) => (dayPlan[block] || []).includes(agentId)) || '';
}

export function agentIdsInDay(dayPlan) {
  const ids = new Set();
  for (const block of ASSIGNABLE_BLOCKS) {
    for (const id of dayPlan[block] || []) ids.add(id);
  }
  return ids;
}

export function removeAgentFromDay(dayPlan, agentId) {
  const next = parseDayPlan(dayPlan);
  for (const block of ASSIGNABLE_BLOCKS) {
    next[block] = next[block].filter((id) => id !== agentId);
  }
  return next;
}

export function addAgentToBlock(dayPlan, block, agentId) {
  const next = parseDayPlan(dayPlan);
  if (next[block].includes(agentId)) return next;
  if (next[block].length >= CAPACITY[block]) return null;
  next[block] = [...next[block], agentId];
  return next;
}

export function stripUnknownAgents(scheduleDays, validIds) {
  const next = {};
  for (const day of DAYS) {
    const dayPlan = parseDayPlan(scheduleDays[day]);
    for (const block of ASSIGNABLE_BLOCKS) {
      dayPlan[block] = dayPlan[block].filter((id) => validIds.has(id));
    }
    next[day] = dayPlan;
  }
  return next;
}

export function countAgentInWeek(scheduleDays, agentId, areaFilter) {
  let count = 0;
  for (const day of DAYS) {
    const dayPlan = scheduleDays[day] || emptyDayPlan();
    for (const block of ASSIGNABLE_BLOCKS) {
      if (!(dayPlan[block] || []).includes(agentId)) continue;
      if (!areaFilter || areaFilter(block)) count += 1;
    }
  }
  return count;
}
