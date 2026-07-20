import { DAYS } from './constants.js';
import { ASSIGNABLE_BLOCKS, SALA_BLOCKS, LOBBY_BLOCKS, OPENING_LOBBY_BLOCK } from './blocks.js';
import { findAgentBlock } from './schedule.js';

const CIERRE_SALA = 'Cierre Sala';
const CIERRE_LOBBY = 'Cierre Lobby';

export function isPoolBlock(block) {
  return block === 'Off' || block === 'Posible Off';
}

export function effectiveDisplayCapacity(block, assignedCount, activeAgentCount) {
  if (isPoolBlock(block)) return Math.max(assignedCount, 0);
  return block === '8:50AM' ? 6 : undefined;
}

export function computeWeeklyDistribution(scheduleDays = {}, agentsById = {}, morningWbdMap = {}) {
  const rows = [];
  for (const agentId of Object.keys(agentsById)) {
    const agent = agentsById[agentId];
    if (!agent?.active) continue;
    const stats = {
      agent,
      days: {},
      sala: 0,
      lobby: 0,
      posibleOff: 0,
      off: 0,
      cierreSala: 0,
      cierreLobby: 0,
      cierre: 0,
      abre: 0,
      wbdMorning: 0,
      wbdEvening: 0,
      assignedDays: 0,
    };

    for (const day of DAYS) {
      const block = findAgentBlock(scheduleDays[day] || {}, agentId);
      stats.days[day] = block ? 1 : 0;
      if ((morningWbdMap[day] || []).includes(agentId)) {
        stats.wbdMorning += 1;
      }
      if (!block) continue;
      stats.assignedDays += 1;
      if (SALA_BLOCKS.includes(block) && block !== CIERRE_SALA) stats.sala += 1;
      if (LOBBY_BLOCKS.includes(block) && ![CIERRE_LOBBY, 'WBD 5:30PM'].includes(block)) stats.lobby += 1;
      if (block === 'Posible Off') stats.posibleOff += 1;
      if (block === 'Off') stats.off += 1;
      if (block === CIERRE_SALA) stats.cierreSala += 1;
      if (block === OPENING_LOBBY_BLOCK) stats.abre += 1;
      if (block === CIERRE_LOBBY) stats.cierreLobby += 1;
      if (block === 'WBD 5:30PM') stats.wbdEvening += 1;
    }

    stats.cierre = stats.cierreSala + stats.cierreLobby;
    rows.push(stats);
  }

  return rows.sort((a, b) => a.agent.name.localeCompare(b.agent.name, 'es'));
}

export function agentsOnVacationForWeek(exceptions = [], forecastRows = []) {
  const datesByDay = Object.fromEntries(
    DAYS.map((day, index) => [day, forecastRows[index]?.date || '']),
  );
  const byAgent = new Map();

  for (const exception of exceptions) {
    if (exception.active === false) continue;
    if (!String(exception.type || '').toUpperCase().includes('VACACIONES')) continue;
    const agentId = exception.agentId;
    if (!agentId) continue;
    if (!byAgent.has(agentId)) {
      byAgent.set(agentId, { agentId, from: exception.from, until: exception.until || exception.from });
    }
  }

  const dayAssignments = {};
  for (const day of DAYS) {
    const date = datesByDay[day];
    dayAssignments[day] = [];
    if (!date) continue;
    for (const entry of byAgent.values()) {
      const dateMs = new Date(`${date}T00:00:00`).getTime();
      const fromMs = new Date(`${entry.from}T00:00:00`).getTime();
      const untilMs = new Date(`${entry.until || entry.from}T00:00:00`).getTime();
      if (dateMs >= fromMs && dateMs <= untilMs) {
        dayAssignments[day].push(entry.agentId);
      }
    }
  }

  const hasAny = DAYS.some((day) => dayAssignments[day]?.length);
  return hasAny ? dayAssignments : null;
}
