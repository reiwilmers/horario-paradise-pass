import { DAYS } from './constants.js';
import { isOpenRequestStatus } from './requests.js';
import { exceptionKind } from './exceptions.js';
import { getAgentMonthGoals, goalTrackingMonthKeys } from './monthlyGoals.js';
import {
  collectUnassignedGroupsForPhase,
  collectWorkflowReminders,
  scheduleSectionMeta,
  scheduleWorkflowPhase,
} from './scheduleWorkflow.js';

const GOAL_TRACKING_CATEGORIES = new Set(['TOP', 'MA', 'MB']);

function parseIsoDate(value = '') {
  const iso = String(value || '').slice(0, 10);
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(reference = new Date()) {
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12);
}

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function formatShortDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
}

function daysUntil(fromDate, reference) {
  const ms = startOfDay(fromDate).getTime() - startOfDay(reference).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function collectPendingRequests(requests = [], agentsById = {}) {
  return requests
    .filter((request) => isOpenRequestStatus(request.status))
    .map((request) => {
      const agent = agentsById[request.applicantId];
      const from = parseIsoDate(request.from || request.date);
      const until = parseIsoDate(request.until || request.from || request.date);
      const range = from && until && until.getTime() !== from.getTime()
        ? `${formatShortDate(from)} → ${formatShortDate(until)}`
        : formatShortDate(from);
      return {
        id: request.id,
        agentName: agent?.name || request.applicantId,
        type: request.type,
        status: request.status,
        dateLabel: range,
        navPage: 'solicitudes',
      };
    })
    .sort((a, b) => a.agentName.localeCompare(b.agentName, 'es'));
}

function isActiveException(exception) {
  if (exception?.active === false) return false;
  const status = String(exception.status || '').toLowerCase();
  return !status.includes('inact') && !status.includes('rechaz');
}

function collectUpcomingVacations(exceptions = [], agentsById = {}, reference = new Date(), horizonDays = 7) {
  const today = startOfDay(reference);
  const limit = addDays(today, horizonDays);
  const items = [];

  for (const exception of exceptions) {
    if (!isActiveException(exception)) continue;
    if (exceptionKind(exception.type) !== 'VACACIONES') continue;
    const from = parseIsoDate(exception.from || exception.date);
    if (!from) continue;
    if (from < today || from > limit) continue;
    const until = parseIsoDate(exception.until || exception.from || exception.date);
    const agent = agentsById[exception.agentId];
    const offset = daysUntil(from, reference);
    items.push({
      id: exception.id,
      agentName: agent?.name || exception.agentId,
      fromLabel: formatShortDate(from),
      untilLabel: formatShortDate(until),
      startsInDays: offset,
      startsLabel: offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : `En ${offset} días`,
      navPage: 'excepciones',
    });
  }

  return items.sort((a, b) => a.startsInDays - b.startsInDays || a.agentName.localeCompare(b.agentName, 'es'));
}

function goalIncompleteReasons(record) {
  const reasons = [];
  if (!record.certGoal) reasons.push('Sin meta de certificados');
  for (const commitment of record.commitments || []) {
    if (!commitment.label || !commitment.target) continue;
    if (commitment.actual == null) {
      reasons.push(`Sin avance: ${commitment.label}`);
    }
  }
  return reasons;
}

function collectGoalsIncomplete(monthlyGoals, year, month, agents = []) {
  if (!month) return [];

  return agents
    .filter((agent) => agent?.active && GOAL_TRACKING_CATEGORIES.has(agent.category))
    .map((agent) => {
      const record = getAgentMonthGoals(monthlyGoals, year, month, agent.id);
      const reasons = goalIncompleteReasons(record);
      if (!reasons.length) return null;
      return {
        agentId: agent.id,
        agentName: agent.name,
        month,
        reasons,
        navPage: 'metas',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.agentName.localeCompare(b.agentName, 'es'));
}

/**
 * @param {object} state
 * @param {Date} [reference]
 */
export function buildTodayReview(state, reference = new Date()) {
  const agents = (state.agents?.ids || [])
    .map((id) => state.agents.byId[id])
    .filter((agent) => agent?.active);
  const agentsById = state.agents?.byId || {};
  const year = state.monthlyGoals?.year || reference.getFullYear();
  const trackingMonths = goalTrackingMonthKeys(reference, year);
  const currentGoalMonth = trackingMonths.at(-1) || null;
  const workflowPhase = scheduleWorkflowPhase(reference);
  const scheduleMeta = scheduleSectionMeta(workflowPhase);

  const pendingRequests = collectPendingRequests(state.requests || [], agentsById);
  const workflowReminders = collectWorkflowReminders(
    workflowPhase,
    state.schedules || {},
    state.forecasts || {},
    agents,
    state.exceptions || [],
    reference,
  );
  const unassigned = collectUnassignedGroupsForPhase(
    workflowPhase,
    state.schedules || {},
    state.forecasts || {},
    agents,
    state.exceptions || [],
    reference,
  );
  const upcomingVacations = collectUpcomingVacations(state.exceptions || [], agentsById, reference);
  const goalsIncomplete = collectGoalsIncomplete(
    state.monthlyGoals,
    year,
    currentGoalMonth,
    agents,
  );

  const workflowUrgent = workflowReminders.filter((item) => item.urgent).length;

  const summary = {
    pendingRequests: pendingRequests.length,
    unassignedDays: unassigned.length,
    unassignedAgents: unassigned.reduce((sum, group) => sum + group.agents.length, 0),
    workflowUrgent,
    upcomingVacations: upcomingVacations.length,
    goalsIncomplete: goalsIncomplete.length,
  };

  summary.total = summary.pendingRequests
    + summary.unassignedAgents
    + summary.workflowUrgent
    + summary.upcomingVacations
    + summary.goalsIncomplete;

  return {
    dateLabel: reference.toLocaleDateString('es-DO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    goalMonth: currentGoalMonth,
    workflowPhase,
    scheduleMeta,
    summary,
    allClear: summary.total === 0,
    pendingRequests,
    workflowReminders,
    unassigned,
    upcomingVacations,
    goalsIncomplete,
  };
}

export { scheduleWorkflowPhase } from './scheduleWorkflow.js';
