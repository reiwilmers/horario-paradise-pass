import { DAYS } from './constants.js';
import {
  BLOCKS,
  MORNING_WBD_BLOCKS,
  OPENING_LOBBY_BLOCK,
  WBD_EVENING_BLOCK,
} from './blocks.js';

function mentionName(agent) {
  if (!agent?.name) return '';
  return `@${agent.name}`;
}

function isMorningWbd(agentId, day, morningWbdMap = {}) {
  return (morningWbdMap[day] || []).includes(agentId);
}

function lobbyLine(agentId, day, agentsById, morningWbdMap, suffix = '') {
  const agent = agentsById[agentId];
  if (!agent?.active) return '';
  const parts = [mentionName(agent)];
  if (suffix) parts.push(suffix);
  if (isMorningWbd(agentId, day, morningWbdMap)) parts.push('📞');
  return parts.join(' ');
}

function sectionHeader(label, opportunities) {
  const value = String(opportunities ?? '').trim();
  if (!value) return `${label}  OPORTUNIDADES`;
  return `${label}  ${value} OPORTUNIDADES`;
}

/**
 * Build WhatsApp tag text for one day: sala + lobby lists with @ mentions.
 */
export function buildWhatsAppDayText({
  day,
  schedule,
  agentsById = {},
  morningWbdMap = {},
  salaOpportunities = '',
  lobbyOpportunities = '',
} = {}) {
  if (!day || !schedule?.days?.[day]) {
    return `${sectionHeader('SALA', salaOpportunities)}\n\n${sectionHeader('LOBBY', lobbyOpportunities)}`;
  }

  const dayPlan = schedule.days[day];
  const lines = [sectionHeader('SALA', salaOpportunities), ''];

  for (const agentId of dayPlan[BLOCKS.SALA_850.key] || []) {
    const line = mentionName(agentsById[agentId]);
    if (line) lines.push(line);
  }
  for (const agentId of dayPlan[BLOCKS.CIERRE_SALA.key] || []) {
    const line = mentionName(agentsById[agentId]);
    if (line) lines.push(`${line} 🔒`);
  }

  lines.push('', sectionHeader('LOBBY', lobbyOpportunities), '');

  for (const agentId of dayPlan[OPENING_LOBBY_BLOCK] || []) {
    const line = lobbyLine(agentId, day, agentsById, morningWbdMap, '7am');
    if (line) lines.push(line);
  }
  for (const agentId of dayPlan[BLOCKS.LOBBY_800.key] || []) {
    const line = lobbyLine(agentId, day, agentsById, morningWbdMap);
    if (line) lines.push(line);
  }
  for (const agentId of dayPlan[BLOCKS.LOBBY_900.key] || []) {
    const line = lobbyLine(agentId, day, agentsById, morningWbdMap);
    if (line) lines.push(line);
  }
  for (const agentId of dayPlan[BLOCKS.POSIBLE_OFF.key] || []) {
    const line = lobbyLine(agentId, day, agentsById, morningWbdMap);
    if (line) lines.push(line);
  }
  for (const agentId of dayPlan[BLOCKS.CIERRE_LOBBY.key] || []) {
    const line = mentionName(agentsById[agentId]);
    if (line) lines.push(`${line}🔒`);
  }

  const eveningWbd = (dayPlan[WBD_EVENING_BLOCK] || [])
    .map((agentId) => agentsById[agentId])
    .filter((agent) => agent?.active);

  if (eveningWbd.length) {
    lines.push('');
    for (const agent of eveningWbd) {
      lines.push(`${mentionName(agent)} 5:30 pm 📞`);
    }
  }

  return lines.join('\n').trim();
}

export function defaultWhatsAppShareDay(weekKey, forecastRows = [], reference = new Date()) {
  const tomorrow = new Date(reference);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  const mondayIso = weekMondayIso(weekKey);

  for (let index = 0; index < DAYS.length; index += 1) {
    const date = forecastRows[index]?.date || addDaysIso(mondayIso, index);
    if (date === tomorrowIso) return DAYS[index];
  }

  const today = new Date(reference);
  today.setHours(12, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  for (let index = 0; index < DAYS.length; index += 1) {
    const date = forecastRows[index]?.date || addDaysIso(mondayIso, index);
    if (date === todayIso) return DAYS[index];
  }

  return DAYS[0];
}

function weekMondayIso(weekKey) {
  const base = new Date();
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  base.setHours(0, 0, 0, 0);
  if (weekKey === 'next') base.setDate(base.getDate() + 7);
  return base.toISOString().slice(0, 10);
}

function addDaysIso(iso, offset) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export { MORNING_WBD_BLOCKS };
