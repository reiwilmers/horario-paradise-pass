import { DAYS } from './constants.js';
import { MORNING_WBD_BLOCKS, getBlock } from './blocks.js';
import { findAgentBlock } from './schedule.js';
import { BLOCK_LIST } from './blocks.js';

const BLOCK_LABELS = Object.fromEntries(
  BLOCK_LIST.map((block) => [block.key, block.visualTime ? `${block.label} (${block.visualTime})` : block.label]),
);

function areaSuffix(block) {
  if (!block) return '';
  if (block.key === 'Cierre Sala') return 'cierre sala';
  if (block.key === 'Cierre Lobby') return 'cierre lobby';
  if (block.key === 'WBD 5:30PM') return 'lobby';
  if (block.key === 'Posible Off') return 'posible off';
  if (block.key === 'Off') return 'off';
  const area = String(block.area || '').toLowerCase();
  if (area === 'sala' || area === 'lobby') return area;
  return '';
}

export function blockDisplayLabel(blockKey = '') {
  const block = getBlock(blockKey);
  if (!block) return BLOCK_LABELS[blockKey] || blockKey || 'Sin asignar';
  const suffix = areaSuffix(block);
  if (suffix.startsWith('cierre') || block.key === 'Posible Off' || block.key === 'Off') {
    return suffix.charAt(0).toUpperCase() + suffix.slice(1);
  }
  if (suffix) return `${block.label} ${suffix}`;
  return BLOCK_LABELS[blockKey] || block.label || blockKey;
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
