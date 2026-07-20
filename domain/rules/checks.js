import { ADMIN_CATEGORIES } from '../constants.js';
import {
  BLOCKS_AFTER_EVENING_WBD,
  MORNING_WBD_BLOCKS,
  OPENING_LOBBY_BLOCK,
  SALA_BLOCKS,
  WBD_EVENING_BLOCK,
  blockArea,
} from '../blocks.js';
import { agentIdsInDay, findAgentBlock } from '../schedule.js';

export function checkAgentActive(agent) {
  if (!agent?.active) return { ok: false, code: 'AGENT_INACTIVE', message: `${agent?.name || 'Agente'} está inactivo.` };
  return { ok: true };
}

export function checkCapacity(_agent, block, _day, ctx) {
  const list = ctx.schedule?.days?.[ctx.day]?.[block] || [];
  const capacity = ctx.capacity?.[block] ?? 99;
  if (list.length >= capacity) {
    return { ok: false, code: 'CAPACITY_FULL', message: `No hay espacio en ${block}.` };
  }
  return { ok: true };
}

export function checkNoDuplicateSameDay(agent, block, day, ctx) {
  if (ctx.allowSameAgent) return { ok: true };
  if (ctx.morningWbdCheck) return { ok: true };
  const dayPlan = ctx.schedule?.days?.[day];
  if (!dayPlan) return { ok: true };
  const currentBlock = findAgentBlock(dayPlan, agent.id);
  if (currentBlock && currentBlock !== block) {
    return { ok: false, code: 'DUPLICATE_DAY', message: `${agent.name} ya está asignado en ${day}.` };
  }
  if (currentBlock === block) {
    return { ok: false, code: 'ALREADY_IN_BLOCK', message: `${agent.name} ya está en ${block}.` };
  }
  return { ok: true };
}

export function checkSupGteRestrictions(agent, block) {
  if (!ADMIN_CATEGORIES.has(agent.category)) return { ok: true };
  const restricted = [OPENING_LOBBY_BLOCK, 'Cierre Sala', 'Cierre Lobby'];
  if (restricted.includes(block)) {
    return {
      ok: false,
      code: 'SUP_GTE_NO_OPEN_CLOSE',
      message: `${agent.name} (SUP/GTE) no puede abrir 7:00 ni cerrar.`,
    };
  }
  return { ok: true };
}

export function checkSpecialRules(agent, block, day, ctx) {
  const rules = agent.rules || {};
  const weekday = ctx.isWeekday?.(day) ?? false;

  if (rules.noOpening7Weekdays && weekday && block === OPENING_LOBBY_BLOCK) {
    return { ok: false, code: 'NO_OPEN_7', message: `${agent.name} no puede abrir 7:00 entre semana.` };
  }
  if (rules.noLobbyCloseWeekdays && weekday && block === 'Cierre Lobby') {
    return { ok: false, code: 'NO_LOBBY_CLOSE', message: `${agent.name} no puede cerrar lobby entre semana.` };
  }
  if (rules.lobbyWeekdaysOnly9AM && weekday && blockArea(block) === 'LOBBY' && block !== '9AM') {
    return { ok: false, code: 'LOBBY_WEEKDAY_9_ONLY', message: `${agent.name} solo puede ir a lobby 9AM entre semana.` };
  }
  if (rules.fixedOffDays?.includes(day) && block !== 'Off') {
    return { ok: false, code: 'FIXED_OFF', message: `${agent.name} tiene Off fijo el ${day}.` };
  }
  if (rules.fixedPossibleOffDays?.includes(day) && !['Posible Off', 'Off'].includes(block)) {
    return { ok: false, code: 'FIXED_POSSIBLE_OFF', message: `${agent.name} tiene Posible Off fijo el ${day}.` };
  }

  const maxSala = rules.maxSalaPerWeek;
  if (maxSala != null && SALA_BLOCKS.includes(block)) {
    const count = ctx.countSalaWeek?.(agent.id) ?? 0;
    if (count >= maxSala) {
      return { ok: false, code: 'MAX_SALA', message: `${agent.name} ya alcanzó máximo ${maxSala} sala esta semana.` };
    }
  }

  const maxLobby = rules.maxLobbyPerWeek;
  if (maxLobby != null && blockArea(block) === 'LOBBY') {
    const count = ctx.countLobbyWeek?.(agent.id) ?? 0;
    if (count >= maxLobby) {
      return { ok: false, code: 'MAX_LOBBY', message: `${agent.name} ya alcanzó máximo ${maxLobby} lobby esta semana.` };
    }
  }

  return { ok: true };
}

export function checkForbiddenPairs(agent, block, day, ctx) {
  const pairIds = agent.rules?.cannotShareAreaWith || [];
  if (!pairIds.length) return { ok: true };
  const area = blockArea(block);
  if (!['SALA', 'LOBBY'].includes(area)) return { ok: true };
  const dayPlan = ctx.schedule?.days?.[day] || {};
  for (const otherId of pairIds) {
    const otherBlock = findAgentBlock(dayPlan, otherId);
    if (!otherBlock) continue;
    if (blockArea(otherBlock) === area) {
      const other = ctx.agentsById?.[otherId];
      return {
        ok: false,
        code: 'FORBIDDEN_PAIR',
        message: `${agent.name} no puede compartir ${area.toLowerCase()} con ${other?.name || otherId} (${day}).`,
      };
    }
  }
  return { ok: true };
}

export function checkEveningWbdEligibility(agent, block) {
  if (block !== WBD_EVENING_BLOCK) return { ok: true };
  if (!agent.eveningWbdEligible) {
    return { ok: false, code: 'NOT_EVENING_WBD_ELIGIBLE', message: `${agent.name} no es elegible para WBD 5:30PM.` };
  }
  return { ok: true };
}

export function checkEveningWbdNextDay(agent, block, day, ctx) {
  if (!BLOCKS_AFTER_EVENING_WBD.includes(block)) return { ok: true };
  const previousDay = ctx.previousDay?.(day);
  if (!previousDay) return { ok: true };
  const prevPlan = ctx.schedule?.days?.[previousDay];
  if ((prevPlan?.[WBD_EVENING_BLOCK] || []).includes(agent.id)) {
    return {
      ok: false,
      code: 'EVENING_WBD_NEXT_DAY',
      message: `${agent.name} no puede ${block} el ${day} después de WBD 5:30PM el día anterior.`,
    };
  }
  return { ok: true };
}

export function checkMorningWbdToggle(agent, block, day, ctx) {
  if (!ctx.morningWbdCheck) return { ok: true };
  if (!MORNING_WBD_BLOCKS.includes(block)) return { ok: true };
  if (!agent.morningWbdEligible) {
    return { ok: false, code: 'NOT_MORNING_WBD_ELIGIBLE', message: `${agent.name} no es elegible WBD mañana.` };
  }
  const wbdIds = ctx.morningWbdMap?.[day] || [];
  if (wbdIds.includes(agent.id)) return { ok: true };
  if (wbdIds.length >= (ctx.morningWbdLimit ?? 3)) {
    return { ok: false, code: 'MORNING_WBD_LIMIT', message: `${day} ya tiene 3 WBD mañana.` };
  }
  const dayPlan = ctx.schedule?.days?.[day];
  if (!dayPlan || !MORNING_WBD_BLOCKS.some((b) => (dayPlan[b] || []).includes(agent.id))) {
    return { ok: false, code: 'WBD_NOT_IN_LOBBY', message: `${agent.name} debe estar en lobby mañana ese día.` };
  }
  return { ok: true };
}

export function checkExceptions(agent, block, day, ctx) {
  const forced = ctx.forcedBlockForAgent?.(agent.id, day);
  if (!forced) return { ok: true };
  if (forced === block) return { ok: true };
  return {
    ok: false,
    code: 'EXCEPTION_FORCED',
    message: `${agent.name} debe estar en ${forced} por excepción (${day}).`,
  };
}

export function checkBrazilPair(agent, block, day, ctx) {
  const pairId = agent.rules?.brazilPairId;
  if (!agent.rules?.brazilMarket || !pairId) return { ok: true };
  const pair = ctx.agentsById?.[pairId];
  if (!pair) return { ok: true };
  const dayPlan = ctx.schedule?.days?.[day] || {};
  const pairBlock = findAgentBlock(dayPlan, pairId);
  const pairArea = pairBlock ? blockArea(pairBlock) : '';
  const agentBlock = findAgentBlock(dayPlan, agent.id);
  const needsSala = ['OFF', 'POSSIBLE', 'LOBBY'].includes(pairArea) || ['Off', 'Posible Off'].includes(pairBlock);
  if (needsSala && block !== '8:50AM' && block !== 'Cierre Sala' && !SALA_BLOCKS.includes(block)) {
    if (agent.id === pairId) return { ok: true };
  }
  if (needsSala && agent.id !== pairId && !SALA_BLOCKS.includes(block)) {
    const pairName = pair.name;
    return {
      ok: false,
      code: 'BRAZIL_PAIR',
      message: `${agent.name} debe cubrir sala porque ${pairName} no está en sala (${day}).`,
    };
  }
  return { ok: true };
}

export function agentsSharingDayArea(dayPlan, area) {
  const ids = [];
  for (const [block, list] of Object.entries(dayPlan || {})) {
    if (blockArea(block) !== area) continue;
    ids.push(...list);
  }
  return ids;
}
