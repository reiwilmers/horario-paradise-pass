import { DAYS, isWeekday, previousDay, ADMIN_CATEGORIES } from './constants.js';
import {
  CAPACITY,
  LOBBY_BLOCKS,
  SALA_BLOCKS,
  MORNING_WBD_BLOCKS,
  WBD_EVENING_BLOCK,
  OPENING_LOBBY_BLOCK,
  ASSIGNABLE_BLOCKS,
} from './blocks.js';
import { canAssign } from './rules/canAssign.js';
import {
  emptyWeekDays,
  findAgentBlock,
  removeAgentFromDay,
  agentIdsInDay,
} from './schedule.js';
import { enrichForecastLobby, lobbySuggestedForDay, forecastDateForDay } from './forecast.js';
import { exceptionBlockFor } from './exceptions.js';
import { isAgentOnVacationOnDate } from './vacations.js';
import { alertsToMessages, collectScheduleAlerts } from './scheduleAlerts.js';

const WORK_BLOCKS = ASSIGNABLE_BLOCKS.filter((block) => block !== 'Posible Off' && block !== 'Off');

function isLobby(block) {
  return LOBBY_BLOCKS.includes(block);
}

function isSala(block) {
  return SALA_BLOCKS.includes(block);
}

function countAreaWeek(days, agentId, predicate) {
  let count = 0;
  for (const day of DAYS) {
    const dayPlan = days[day] || {};
    for (const block of WORK_BLOCKS) {
      if (!predicate(block)) continue;
      if ((dayPlan[block] || []).includes(agentId)) count += 1;
    }
  }
  return count;
}

function countBlockWeek(days, agentId, block) {
  return DAYS.reduce((total, day) => total + ((days[day]?.[block] || []).includes(agentId) ? 1 : 0), 0);
}

function normalizeAgents(agents = []) {
  return agents.filter((agent) => agent?.active !== false);
}

function chooseSupOffDays(forecast = []) {
  const choices = ['Miercoles', 'Jueves'].map((dayName) => ({
    day: dayName,
    score: lobbySuggestedForDay(forecast, dayName),
  }));
  choices.sort((a, b) => a.score - b.score);
  return { persis: choices[0]?.day || 'Miercoles', berno: choices[1]?.day || 'Jueves' };
}

function reservedOffDay(agent, forecast) {
  const sup = chooseSupOffDays(forecast);
  if (agent.id === 'persis') return sup.persis;
  if (agent.id === 'berno') return sup.berno;
  if (agent.rules?.fixedOffDays?.length) return agent.rules.fixedOffDays[0];
  const spread = [...DAYS];
  const hash = agent.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return spread[Math.abs(hash) % spread.length];
}

function reservedPossibleDay(agent, forecast) {
  const off = reservedOffDay(agent, forecast);
  if (agent.rules?.fixedPossibleOffDays?.length) return agent.rules.fixedPossibleOffDays[0];
  if (agent.id === 'persis' || agent.id === 'berno') return off === 'Miercoles' ? 'Jueves' : 'Miercoles';
  return '';
}

function hardBlock(agent, day, date, exceptions, forecast) {
  if (isAgentOnVacationOnDate(agent.id, date, exceptions)) return '';
  const ex = exceptionBlockFor(agent.id, date, exceptions);
  if (ex) return ex;
  if (day === reservedOffDay(agent, forecast)) return 'Off';
  if (day === reservedPossibleDay(agent, forecast)) return 'Posible Off';
  return '';
}

function buildContext(days, agentsById, morningWbdMap, day, exceptions, forecast) {
  const schedule = { weekKey: 'current', mondayIso: '', days, updatedAt: '' };
  return {
    schedule,
    agentsById,
    capacity: CAPACITY,
    day,
    morningWbdMap,
    isWeekday,
    previousDay,
    countSalaWeek: (agentId) => countAreaWeek(days, agentId, isSala),
    countLobbyWeek: (agentId) => countAreaWeek(days, agentId, isLobby),
    forcedBlockForAgent: (agentId, d) => hardBlock(agentsById[agentId], d, forecastDateForDay(forecast, d), exceptions, forecast),
  };
}

function tryPlace(days, agent, block, day, ctx) {
  if (!agent) return false;
  const original = days[day];
  const cleared = removeAgentFromDay(original, agent.id);
  days[day] = cleared;
  const result = canAssign(agent, block, day, { ...ctx, day, schedule: { ...ctx.schedule, days } });
  if (!result.ok) {
    days[day] = original;
    return false;
  }
  days[day] = {
    ...cleared,
    [block]: [...(cleared[block] || []), agent.id],
  };
  return true;
}

function teamAverages(days, team) {
  const sellers = team.filter((agent) => ['TOP', 'MA', 'MB'].includes(agent.category));
  if (!sellers.length) return { sala: 0, lobby: 0 };
  return {
    sala: sellers.reduce((sum, agent) => sum + countAreaWeek(days, agent.id, isSala), 0) / sellers.length,
    lobby: sellers.reduce((sum, agent) => sum + countAreaWeek(days, agent.id, isLobby), 0) / sellers.length,
  };
}

function fairnessBoost(agent, block, days, team) {
  const rules = agent.rules || {};
  if (rules.priorityArea === 'SALA' && isLobby(block)) return -35;
  if (rules.priorityArea === 'LOBBY' && isSala(block)) return -35;
  if (rules.priorityArea === 'SALA' || rules.priorityArea === 'LOBBY') return 0;
  const averages = teamAverages(days, team);
  const sala = countAreaWeek(days, agent.id, isSala);
  const lobby = countAreaWeek(days, agent.id, isLobby);
  let boost = 0;
  if (isSala(block)) boost += (averages.sala - sala) * 10;
  if (isLobby(block)) boost += (averages.lobby - lobby) * 10;
  return boost;
}

function scoreAgent(agent, block, days, day, morningWbdCounts, team) {
  const rules = agent.rules || {};
  let value = 0;
  if (rules.priorityArea === 'SALA' && isSala(block)) value += 50;
  if (rules.priorityArea === 'LOBBY' && isLobby(block)) value += 50;
  if (rules.priorityArea === 'BALANCE') {
    value += isSala(block)
      ? Math.max(0, 35 - countAreaWeek(days, agent.id, isSala) * 12)
      : Math.max(0, 35 - countAreaWeek(days, agent.id, isLobby) * 12);
  }
  if (agent.category === 'TOP' && isLobby(block)) value += 15;
  if (agent.category === 'MA') value += 8;
  if (agent.category === 'MB' && block === 'Posible Off') value += 30 - countBlockWeek(days, agent.id, 'Posible Off') * 20;
  if (agent.id === 'cris' && isLobby(block)) value += 80;
  if (agent.id === 'rei' && isSala(block)) value += 80;
  if (agent.id === 'persis' && isLobby(block)) value += 70;
  if (agent.id === 'berno' && isSala(block)) value += 70;
  if ((agent.id === 'camila' || agent.id === 'renata') && isSala(block)) value += 65;
  if ((agent.id === 'lau' || agent.id === 'mich') && block === '9AM' && isWeekday(day)) value += 100;
  if (agent.morningWbdEligible && MORNING_WBD_BLOCKS.includes(block)) {
    value += 25 - (morningWbdCounts[agent.id] || 0) * 10;
  }
  if (block === OPENING_LOBBY_BLOCK) value -= countBlockWeek(days, agent.id, OPENING_LOBBY_BLOCK) * 20;
  if (block === WBD_EVENING_BLOCK && agent.eveningWbdEligible) {
    value += 40 - countBlockWeek(days, agent.id, WBD_EVENING_BLOCK) * 25;
  }
  if (block === 'Cierre Sala') value -= countBlockWeek(days, agent.id, 'Cierre Sala') * 25;
  if (block === 'Cierre Lobby') value -= countBlockWeek(days, agent.id, 'Cierre Lobby') * 25;
  value += fairnessBoost(agent, block, days, team);
  return value;
}

function bestCandidate(team, days, block, day, ctx, morningWbdCounts, filter = () => true) {
  return team
    .filter(filter)
    .filter((agent) => !agentIdsInDay(days[day]).has(agent.id))
    .filter((agent) => {
      const original = days[day];
      const cleared = removeAgentFromDay(original, agent.id);
      days[day] = cleared;
      const ok = canAssign(agent, block, day, { ...ctx, day, schedule: { ...ctx.schedule, days } }).ok;
      days[day] = original;
      return ok;
    })
    .sort((a, b) => scoreAgent(b, block, days, day, morningWbdCounts, team) - scoreAgent(a, block, days, day, morningWbdCounts, team))[0];
}

function fillBlock(days, team, block, target, day, ctx, morningWbdCounts, filter = () => true) {
  let guard = 0;
  while ((days[day][block] || []).length < target && guard < team.length + 5) {
    guard += 1;
    const before = (days[day][block] || []).length;
    const agent = bestCandidate(team, days, block, day, ctx, morningWbdCounts, filter);
    if (!agent || !tryPlace(days, agent, block, day, ctx)) break;
    if ((days[day][block] || []).length === before) break;
  }
}

function placeHardBlocks(days, team, day, ctx, exceptions, forecast) {
  const date = forecastDateForDay(forecast, day);
  team.forEach((agent) => {
    const block = hardBlock(agent, day, date, exceptions, forecast);
    if (block) tryPlace(days, agent, block, day, ctx);
  });
}

function protectKeyRoles(days, team, day, ctx) {
  ['rei', 'berno', 'camila', 'renata'].forEach((id) => {
    tryPlace(days, team.find((agent) => agent.id === id), '8:50AM', day, ctx);
  });
  ['cris', 'persis'].forEach((id) => {
    tryPlace(days, team.find((agent) => agent.id === id), '9AM', day, ctx);
  });
  ['yaque', 'luny'].forEach((id) => {
    tryPlace(days, team.find((agent) => agent.id === id), '8AM', day, ctx);
  });
}

function assignMorningWbd(days, team, day, ctx, morningWbdCounts, morningWbdMap) {
  const wbd = [];
  for (const block of ['8AM', '9AM', OPENING_LOBBY_BLOCK]) {
    for (const id of days[day][block] || []) {
      const agent = team.find((item) => item.id === id);
      if (agent?.morningWbdEligible && !wbd.includes(id)) wbd.push(id);
    }
  }
  while (wbd.length < 3) {
    const before = wbd.length;
    const block = (days[day]['8AM'] || []).length <= (days[day]['9AM'] || []).length ? '8AM' : '9AM';
    const agent = bestCandidate(
      team,
      days,
      block,
      day,
      ctx,
      morningWbdCounts,
      (item) => item.morningWbdEligible && !wbd.includes(item.id),
    );
    if (!agent || !tryPlace(days, agent, block, day, ctx)) break;
    if (!wbd.includes(agent.id)) wbd.push(agent.id);
    for (const b of MORNING_WBD_BLOCKS) {
      if ((days[day][b] || []).includes(agent.id) && !wbd.includes(agent.id)) wbd.push(agent.id);
    }
    if (wbd.length === before) break;
  }
  morningWbdMap[day] = wbd.slice(0, 3);
  morningWbdMap[day].forEach((id) => {
    morningWbdCounts[id] = (morningWbdCounts[id] || 0) + 1;
  });
}

function assignRemaining(days, team, day, ctx, morningWbdCounts, exceptions, forecast) {
  const used = agentIdsInDay(days[day]);
  const remaining = team.filter((agent) => !used.has(agent.id));
  const order = [...remaining].sort((a, b) => {
    const rank = { MB: 1, MA: 2, TOP: 3, SUP: 4, GTE: 5 };
    return (rank[a.category] || 9) - (rank[b.category] || 9)
      || countBlockWeek(days, a.id, 'Posible Off') - countBlockWeek(days, b.id, 'Posible Off');
  });
  order.forEach((agent) => {
    const date = forecastDateForDay(forecast, day);
    if (isAgentOnVacationOnDate(agent.id, date, exceptions)) return;
    const preferred = [];
    if (countBlockWeek(days, agent.id, 'Off') === 0) preferred.push('Off');
    if (agent.category === 'MB') preferred.push('Posible Off');
    preferred.push('9AM', '8AM', '8:50AM', 'Posible Off', 'Off');
    preferred.some((block) => tryPlace(days, agent, block, day, ctx));
  });
}

function ensureEveryonePlaced(days, team, day, ctx, exceptions, forecast) {
  let guard = 0;
  while (guard < team.length) {
    guard += 1;
    const used = agentIdsInDay(days[day]);
    const date = forecastDateForDay(forecast, day);
    const missing = team.find((agent) => (
      !used.has(agent.id) && !isAgentOnVacationOnDate(agent.id, date, exceptions)
    ));
    if (!missing) break;
    if (tryPlace(days, missing, 'Off', day, ctx)) continue;
    if (tryPlace(days, missing, 'Posible Off', day, ctx)) continue;
    break;
  }
}

function validateSchedule(days, team, forecast, exceptions, morningWbdMap) {
  return alertsToMessages(collectScheduleAlerts({
    days,
    agents: team,
    forecast,
    exceptions,
    morningWbdMap,
  }));
}

/**
 * @param {object} params
 * @returns {{ days: object, morningWbdMap: object, alerts: string[] }}
 */
export function generateSchedule({
  agents = [],
  forecast = [],
  exceptions = [],
  forecastSettings = {},
  previousMorningWbdMap = {},
} = {}) {
  const team = normalizeAgents(agents);
  const enrichedForecast = enrichForecastLobby(forecast, forecastSettings);
  const days = emptyWeekDays();
  const morningWbdMap = {};
  const morningWbdCounts = Object.fromEntries(
    team.map((agent) => [
      agent.id,
      Object.values(previousMorningWbdMap || {}).flat().filter((id) => id === agent.id).length,
    ]),
  );
  const agentsById = Object.fromEntries(team.map((agent) => [agent.id, agent]));
  const alerts = [];

  for (const day of DAYS) {
    const ctx = buildContext(days, agentsById, morningWbdMap, day, exceptions, enrichedForecast);
    const lobbyTarget = Math.max(3, lobbySuggestedForDay(enrichedForecast, day));

    placeHardBlocks(days, team, day, ctx, exceptions, enrichedForecast);
    protectKeyRoles(days, team, day, ctx);

    fillBlock(days, team, 'Cierre Sala', 1, day, ctx, morningWbdCounts, (agent) => !ADMIN_CATEGORIES.has(agent.category));
    fillBlock(days, team, 'Cierre Lobby', 1, day, ctx, morningWbdCounts, (agent) => !ADMIN_CATEGORIES.has(agent.category));
    fillBlock(days, team, OPENING_LOBBY_BLOCK, 2, day, ctx, morningWbdCounts, (agent) => !ADMIN_CATEGORIES.has(agent.category));

    assignMorningWbd(days, team, day, ctx, morningWbdCounts, morningWbdMap);

    fillBlock(days, team, '9AM', Math.max(0, Math.min(3, lobbyTarget - 3)), day, ctx, morningWbdCounts);
    fillBlock(
      days,
      team,
      '8AM',
      Math.max(
        0,
        lobbyTarget
          - ((days[day][OPENING_LOBBY_BLOCK] || []).length
            + (days[day]['9AM'] || []).length
            + (days[day]['Cierre Lobby'] || []).length),
      ),
      day,
      ctx,
      morningWbdCounts,
    );
    fillBlock(days, team, '8:50AM', 6, day, ctx, morningWbdCounts);
    fillBlock(
      days,
      team,
      WBD_EVENING_BLOCK,
      1,
      day,
      ctx,
      morningWbdCounts,
      (agent) => agent.eveningWbdEligible,
    );
    assignRemaining(days, team, day, ctx, morningWbdCounts, exceptions, enrichedForecast);
    ensureEveryonePlaced(days, team, day, ctx, exceptions, enrichedForecast);
  }

  const validation = validateSchedule(days, team, enrichedForecast, exceptions, morningWbdMap);
  return {
    days,
    morningWbdMap,
    alerts: [...new Set([...alerts, ...validation])],
  };
}
