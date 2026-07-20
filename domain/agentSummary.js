import { DAYS } from './constants.js';
import { MORNING_WBD_BLOCKS } from './blocks.js';
import { findAgentBlock } from './schedule.js';
import { BLOCK_LIST } from './blocks.js';

const BLOCK_LABELS = Object.fromEntries(
  BLOCK_LIST.map((block) => [block.key, block.visualTime ? `${block.label} (${block.visualTime})` : block.label]),
);

export function blockDisplayLabel(blockKey = '') {
  return BLOCK_LABELS[blockKey] || blockKey || 'Sin asignar';
}

export function buildAgentWeekSummary(scheduleDays = {}, agentId, { morningWbdMap = {}, forecastRows = [] } = {}) {
  return DAYS.map((day, index) => {
    const block = findAgentBlock(scheduleDays[day] || {}, agentId);
    const date = forecastRows[index]?.date || '';
    const wbd = Boolean(block && MORNING_WBD_BLOCKS.includes(block) && (morningWbdMap[day] || []).includes(agentId));
    return {
      day,
      date,
      block,
      label: block ? blockDisplayLabel(block) : 'Sin asignar',
      wbd,
    };
  });
}

export function filterRequestsForAgent(requests = [], agentId) {
  return requests.filter((request) => request.applicantId === agentId);
}
