import { DAYS } from './constants.js';
import { collectUnassignedAlerts, unassignedAgentsByDay } from './scheduleAlerts.js';
import { weekRangeLabel } from './forecast.js';

export const SCHEDULE_WORKFLOW = {
  QUIET: 'quiet',
  FORECAST: 'forecast',
  BUILD: 'build',
  VERIFY: 'verify',
};

/** Mon–Wed quiet, Thu forecast, Fri build, Sat–Sun verify next-week assignments. */
export function scheduleWorkflowPhase(reference = new Date()) {
  const day = reference.getDay();
  if (day >= 1 && day <= 3) return SCHEDULE_WORKFLOW.QUIET;
  if (day === 4) return SCHEDULE_WORKFLOW.FORECAST;
  if (day === 5) return SCHEDULE_WORKFLOW.BUILD;
  return SCHEDULE_WORKFLOW.VERIFY;
}

export function shouldShowUnassignedAlerts(reference = new Date()) {
  return scheduleWorkflowPhase(reference) === SCHEDULE_WORKFLOW.VERIFY;
}

export function isNextForecastComplete(forecastRows = []) {
  if (!Array.isArray(forecastRows) || forecastRows.length < DAYS.length) return false;
  return forecastRows.every((row) => {
    const total = Number(row?.total);
    return Number.isFinite(total) && total > 0;
  });
}

export function countUnassignedInWeek(scheduleDays = {}, agents = [], forecast = [], exceptions = []) {
  return collectUnassignedAlerts({
    days: scheduleDays,
    agents,
    forecast,
    exceptions,
  }).length;
}

export function isNextScheduleComplete(schedules = {}, forecasts = {}, agents = [], exceptions = []) {
  return countUnassignedInWeek(
    schedules.next?.days || {},
    agents,
    forecasts.next || [],
    exceptions,
  ) === 0;
}

function dayHeaderLabel(day, forecastRows = []) {
  const index = DAYS.indexOf(day);
  const date = forecastRows[index]?.date;
  if (!date) return day;
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return `${day} ${parsed.getDate()}`;
}

export function collectUnassignedGroupsForPhase(phase, schedules, forecasts, agents, exceptions, reference = new Date()) {
  if (phase !== SCHEDULE_WORKFLOW.VERIFY) return [];

  const alerts = collectUnassignedAlerts({
    days: schedules.next?.days || {},
    agents,
    forecast: forecasts.next || [],
    exceptions,
  });
  const byDay = unassignedAgentsByDay(alerts);
  const groups = [];

  for (const day of DAYS) {
    const names = byDay[day];
    if (!names?.length) continue;
    groups.push({
      weekKey: 'next',
      day,
      dayLabel: dayHeaderLabel(day, forecasts.next || []),
      agents: names,
      navPage: 'dashboard',
    });
  }

  return groups;
}

export function collectWorkflowReminders(phase, schedules, forecasts, agents, exceptions, reference = new Date()) {
  const nextLabel = weekRangeLabel('next', reference);
  const reminders = [];

  if (phase === SCHEDULE_WORKFLOW.FORECAST) {
    const complete = isNextForecastComplete(forecasts.next || []);
    reminders.push({
      id: 'next-forecast',
      type: 'forecast',
      title: complete ? 'Forecast próxima semana listo' : 'Llenar forecast de próxima semana',
      subtitle: nextLabel,
      navPage: 'forecast',
      complete,
      urgent: !complete,
    });
    return reminders;
  }

  if (phase === SCHEDULE_WORKFLOW.BUILD) {
    const complete = isNextScheduleComplete(schedules, forecasts, agents, exceptions);
    reminders.push({
      id: 'next-schedule',
      type: 'schedule',
      title: complete ? 'Horario próxima semana listo' : 'Armar horario de próxima semana',
      subtitle: nextLabel,
      navPage: 'dashboard',
      complete,
      urgent: !complete,
    });
    return reminders;
  }

  return reminders;
}

export function scheduleSectionMeta(phase) {
  switch (phase) {
    case SCHEDULE_WORKFLOW.FORECAST:
    case SCHEDULE_WORKFLOW.BUILD:
      return {
        showWorkflow: true,
        showUnassigned: false,
        workflowTitle: 'Planificación semanal',
        unassignedTitle: '',
        quietNote: '',
      };
    case SCHEDULE_WORKFLOW.VERIFY:
      return {
        showWorkflow: false,
        showUnassigned: true,
        workflowTitle: '',
        unassignedTitle: 'Agentes sin asignar — próxima semana',
        quietNote: '',
      };
    default:
      return {
        showWorkflow: false,
        showUnassigned: false,
        workflowTitle: '',
        unassignedTitle: '',
        quietNote: 'La revisión de huecos en el horario se activa sábado y domingo. Forecast: jueves · Horario: viernes.',
      };
  }
}
