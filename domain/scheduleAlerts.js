import { DAYS, isWeekday, previousDay } from './constants.js';
import { CAPACITY, SALA_BLOCKS, LOBBY_BLOCKS } from './blocks.js';
import { canAssign } from './rules/canAssign.js';
import { findAgentBlock } from './schedule.js';
import { forecastDateForDay } from './forecast.js';
import { exceptionBlockFor } from './exceptions.js';
import { isAgentOnVacationOnDate } from './vacations.js';

export const ALERT_KIND = {
  UNASSIGNED: 'unassigned',
  VACATION_IN_POOL: 'vacation_in_pool',
  RULE_VIOLATION: 'rule_violation',
  WBD_SHORT: 'wbd_short',
};

function countAreaWeek(days, agentId, blocks) {
  let count = 0;
  for (const day of DAYS) {
    const block = findAgentBlock(days[day] || {}, agentId);
    if (block && blocks.includes(block)) count += 1;
  }
  return count;
}

function buildValidationContext(days, agentsById, morningWbdMap, day, exceptions, forecast) {
  const schedule = { weekKey: 'current', mondayIso: '', days, updatedAt: '' };
  return {
    schedule,
    agentsById,
    capacity: CAPACITY,
    day,
    morningWbdMap,
    isWeekday,
    previousDay,
    countSalaWeek: (agentId) => countAreaWeek(days, agentId, SALA_BLOCKS),
    countLobbyWeek: (agentId) => countAreaWeek(days, agentId, LOBBY_BLOCKS),
    forcedBlockForAgent: (agentId) => {
      const date = forecastDateForDay(forecast, day);
      return exceptionBlockFor(agentId, date, exceptions);
    },
  };
}

/**
 * @param {object} params
 * @returns {Array<{ kind: string, day: string, agentId?: string, agentName?: string, message: string }>}
 */
export function collectScheduleAlerts({
  days = {},
  agents = [],
  forecast = [],
  exceptions = [],
  morningWbdMap = {},
} = {}) {
  const team = agents.filter((agent) => agent?.active);
  const agentsById = Object.fromEntries(team.map((agent) => [agent.id, agent]));
  const alerts = [];

  for (const day of DAYS) {
    const ctx = buildValidationContext(days, agentsById, morningWbdMap, day, exceptions, forecast);

    for (const agent of team) {
      const date = forecastDateForDay(forecast, day);
      const onVacation = isAgentOnVacationOnDate(agent.id, date, exceptions);
      const block = findAgentBlock(days[day] || {}, agent.id);

      if (onVacation) {
        if (block === 'Off' || block === 'Posible Off') {
          alerts.push({
            kind: ALERT_KIND.VACATION_IN_POOL,
            day,
            agentId: agent.id,
            agentName: agent.name,
            message: `${agent.name} | ${day} | En vacaciones no debe aparecer en ${block}.`,
          });
        }
        continue;
      }

      if (!block) {
        alerts.push({
          kind: ALERT_KIND.UNASSIGNED,
          day,
          agentId: agent.id,
          agentName: agent.name,
          message: `${agent.name} | ${day} | No aparece en el día.`,
        });
        continue;
      }

      const result = canAssign(agent, block, day, { ...ctx, allowSameAgent: true });
      if (!result.ok) {
        alerts.push({
          kind: ALERT_KIND.RULE_VIOLATION,
          day,
          agentId: agent.id,
          agentName: agent.name,
          message: `${agent.name} | ${day} | ${result.message}`,
        });
      }
    }

    if ((morningWbdMap[day] || []).length < 3) {
      alerts.push({
        kind: ALERT_KIND.WBD_SHORT,
        day,
        message: `Faltan WBD mañana en ${day}: ${(morningWbdMap[day] || []).length}/3.`,
      });
    }
  }

  const seen = new Set();
  return alerts.filter((alert) => {
    const key = alert.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
}

export function alertsToMessages(alerts = []) {
  return alerts.map((alert) => alert.message);
}

export function unassignedAgentsByDay(alerts = []) {
  /** @type {Record<string, string[]>} */
  const byDay = {};
  for (const alert of alerts) {
    if (alert.kind !== ALERT_KIND.UNASSIGNED || !alert.agentName) continue;
    if (!byDay[alert.day]) byDay[alert.day] = [];
    byDay[alert.day].push(alert.agentName);
  }
  for (const day of Object.keys(byDay)) {
    byDay[day].sort((a, b) => a.localeCompare(b, 'es'));
  }
  return byDay;
}

export function daysWithAlertKinds(alerts = [], kinds = []) {
  const allowed = new Set(kinds);
  return new Set(
    alerts
      .filter((alert) => allowed.has(alert.kind))
      .map((alert) => alert.day),
  );
}

export function unassignedCount(alerts = []) {
  return alerts.filter((alert) => alert.kind === ALERT_KIND.UNASSIGNED).length;
}

export function otherAlertCount(alerts = []) {
  return alerts.filter((alert) => alert.kind !== ALERT_KIND.UNASSIGNED).length;
}
