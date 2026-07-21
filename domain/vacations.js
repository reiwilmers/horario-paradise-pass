import { exceptionApplies, exceptionKind } from './exceptions.js';
import { isRequestApproved } from './requests.js';

export function countInclusiveDays(from, until = from) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${until || from}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function isAgentOnVacationOnDate(agentId, date, exceptions = []) {
  if (!agentId || !date) return false;
  return exceptions.some((exception) => (
    exception.agentId === agentId
    && exception.active !== false
    && exceptionKind(exception.type) === 'VACACIONES'
    && exceptionApplies(exception, date)
  ));
}

export function agentVacationPeriods(agentId, exceptions = [], requests = []) {
  const periods = [];
  const seen = new Set();

  for (const exception of exceptions) {
    if (exception.agentId !== agentId || exception.active === false) continue;
    if (exceptionKind(exception.type) !== 'VACACIONES') continue;
    const from = exception.from || exception.date || '';
    const until = exception.until || from;
    if (!from) continue;
    const key = `${from}|${until}`;
    if (seen.has(key)) continue;
    seen.add(key);
    periods.push({
      from,
      until,
      days: countInclusiveDays(from, until),
      status: exception.status || 'Activa',
    });
  }

  for (const request of requests) {
    if (request.applicantId !== agentId || request.type !== 'Vacaciones') continue;
    if (!isRequestApproved(request)) continue;
    const from = request.from || request.date || '';
    const until = request.until || from;
    if (!from) continue;
    const key = `${from}|${until}`;
    if (seen.has(key)) continue;
    seen.add(key);
    periods.push({
      from,
      until,
      days: countInclusiveDays(from, until),
      status: request.status || 'Aprobada',
    });
  }

  return periods.sort((a, b) => String(b.from).localeCompare(String(a.from)));
}

export function totalVacationDays(periods = []) {
  return periods.reduce((sum, period) => sum + (period.days || 0), 0);
}

export function formatVacationRange(from, until) {
  if (!from) return '—';
  if (!until || until === from) return from;
  return `${from} — ${until}`;
}
