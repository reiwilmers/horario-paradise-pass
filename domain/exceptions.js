import { DAYS } from './constants.js';

export function exceptionKind(type = '') {
  const value = String(type).toUpperCase();
  if (value.includes('VACACIONES')) return 'VACACIONES';
  if (value.includes('POSIBLE')) return 'POSIBLE_OFF_SOLICITADO';
  if (value.includes('OFF_SOLICITADO') || value === 'OFF SOLICITADO') return 'OFF_SOLICITADO';
  if (value.includes('PERMISO')) return 'PERMISO';
  if (value.includes('CAMBIO')) return 'CAMBIO_HORARIO';
  return value;
}

export function exceptionApplies(exception, date) {
  if (!date || exception?.active === false) return false;
  const status = String(exception.status || '').toLowerCase();
  if (status.includes('inact') || status.includes('rechaz')) return false;
  const from = exception.from || exception.date || '';
  const until = exception.until || from;
  const dateMs = new Date(`${date}T00:00:00`).getTime();
  const fromMs = new Date(`${from}T00:00:00`).getTime();
  const untilMs = new Date(`${until}T00:00:00`).getTime();
  if (Number.isNaN(dateMs) || Number.isNaN(fromMs) || Number.isNaN(untilMs)) return false;
  return dateMs >= fromMs && dateMs <= untilMs;
}

export function exceptionTypeToBlock(type = '') {
  const kind = exceptionKind(type);
  if (kind === 'VACACIONES') return '';
  if (kind === 'POSIBLE_OFF_SOLICITADO') return 'Posible Off';
  if (['OFF_SOLICITADO', 'PERMISO'].includes(kind)) return 'Off';
  return '';
}

export function exceptionBlockFor(agentId, date, exceptions = []) {
  const hits = exceptions
    .filter((item) => item.agentId === agentId && exceptionApplies(item, date))
    .map((item) => exceptionKind(item.type));
  if (hits.includes('VACACIONES')) return '';
  if (hits.includes('OFF_SOLICITADO') || hits.includes('PERMISO')) return 'Off';
  if (hits.includes('POSIBLE_OFF_SOLICITADO')) return 'Posible Off';
  return '';
}

export function forcedBlockForAgent(agentId, day, date, exceptions = []) {
  return exceptionBlockFor(agentId, date, exceptions);
}

export function dedupeExceptionsByRequest(exceptions = []) {
  const byId = new Map();
  for (const item of exceptions) {
    if (!item?.id) continue;
    const existing = byId.get(item.id);
    if (!existing || String(item.updatedAt || '') >= String(existing.updatedAt || '')) {
      byId.set(item.id, item);
    }
  }
  const byRequest = new Map();
  for (const item of byId.values()) {
    if (item.requestId) {
      const prev = byRequest.get(item.requestId);
      if (!prev || String(item.updatedAt || '') >= String(prev.updatedAt || '')) {
        byRequest.set(item.requestId, item);
      }
    }
  }
  const result = [];
  const seenRequestIds = new Set();
  for (const item of byId.values()) {
    if (item.requestId) {
      if (seenRequestIds.has(item.requestId)) continue;
      seenRequestIds.add(item.requestId);
      result.push(byRequest.get(item.requestId) || item);
      continue;
    }
    result.push(item);
  }
  return result;
}

export function activeScheduleExceptions(exceptions = []) {
  return exceptions.filter((exception) => {
    if (exception.active === false) return false;
    const status = String(exception.status || '').toLowerCase();
    if (status.includes('inact')) return false;
    return ['VACACIONES', 'OFF_SOLICITADO', 'POSIBLE_OFF_SOLICITADO', 'PERMISO'].includes(
      exceptionKind(exception.type),
    );
  });
}
