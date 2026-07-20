import { REQUEST_TYPES } from './constants.js';
import { exceptionKind } from './exceptions.js';

export const REQUEST_STATUSES = ['Pendiente', 'Aprobada', 'Rechazada', 'Fuera de tiempo'];
export const EXCEPTION_TYPES = [
  'OFF_SOLICITADO',
  'POSIBLE_OFF_SOLICITADO',
  'VACACIONES',
  'PERMISO',
  'CAMBIO_HORARIO',
];
export const EXCEPTION_STATUSES = ['Activa', 'Inactiva', 'En revision', 'Resuelta'];
export const REQUEST_EXCEPTION_PREFIX = 'request-exception-';

export function createId(prefix = 'req') {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function requestTypeToExceptionType(type = '') {
  if (type === 'Vacaciones') return 'VACACIONES';
  if (type === 'Posible off') return 'POSIBLE_OFF_SOLICITADO';
  if (type === 'Off solicitado') return 'OFF_SOLICITADO';
  if (type === 'Cambio de horario con otro agente') return 'CAMBIO_HORARIO';
  return '';
}

export function parseRequest(raw = {}) {
  const errors = [];
  const applicantId = String(raw.applicantId || '').trim();
  const type = String(raw.type || '').trim();
  if (!applicantId) errors.push('applicantId required');
  if (!REQUEST_TYPES.includes(type)) errors.push('type invalid');
  const from = String(raw.from || raw.date || '').trim();
  const until = String(raw.until || from).trim();
  if (!from && type !== 'Cambio de horario con otro agente') errors.push('date required');
  const status = REQUEST_STATUSES.includes(raw.status) ? raw.status : 'Pendiente';
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: String(raw.id || createId('req')),
      applicantId,
      type,
      date: from,
      from,
      until,
      swapWithId: String(raw.swapWithId || '').trim(),
      currentTime: String(raw.currentTime || '').trim(),
      requestedTime: String(raw.requestedTime || '').trim(),
      reason: String(raw.reason || '').trim(),
      status,
      specialApproval: Boolean(raw.specialApproval),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
      createdByAdminId: raw.createdByAdminId || null,
      createdByAdmin: Boolean(raw.createdByAdmin),
    },
  };
}

export function parseException(raw = {}) {
  const errors = [];
  const agentId = String(raw.agentId || '').trim();
  const type = String(raw.type || '').trim();
  if (!agentId) errors.push('agentId required');
  if (!type) errors.push('type required');
  const from = String(raw.from || raw.date || '').trim();
  const until = String(raw.until || from).trim();
  if (!from) errors.push('from required');
  const status = EXCEPTION_STATUSES.includes(raw.status) ? raw.status : 'Activa';
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: String(raw.id || createId('ex')),
      requestId: raw.requestId || null,
      type,
      agentId,
      from,
      until,
      detail: String(raw.detail || raw.reason || '').trim(),
      priority: ['Baja', 'Media', 'Alta'].includes(raw.priority) ? raw.priority : 'Media',
      status,
      active: raw.active !== false,
      createdFromRequest: Boolean(raw.createdFromRequest),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    },
  };
}

export function isRequestApproved(request) {
  return String(request?.status || '').toLowerCase().includes('aprob');
}

export function isRequestRejected(request) {
  return String(request?.status || '').toLowerCase().includes('rechaz');
}

export function requestExceptionId(requestId) {
  return `${REQUEST_EXCEPTION_PREFIX}${requestId}`;
}

export function exceptionFromApprovedRequest(request) {
  const exType = requestTypeToExceptionType(request.type);
  return {
    id: requestExceptionId(request.id),
    requestId: request.id,
    type: exType,
    agentId: request.applicantId,
    from: request.from || request.date,
    until: request.until || request.from || request.date,
    detail: request.reason || request.type,
    priority: request.status === 'Fuera de tiempo' || request.specialApproval ? 'Alta' : 'Media',
    status: isRequestApproved(request) ? 'Activa' : 'Inactiva',
    active: isRequestApproved(request),
    createdFromRequest: true,
    updatedAt: new Date().toISOString(),
  };
}

export function syncExceptionsFromRequests(requests = [], existing = []) {
  const approved = requests.filter((request) => isRequestApproved(request) && requestTypeToExceptionType(request.type));
  const approvedIds = new Set(approved.map((request) => request.id));
  const unmanaged = existing.filter((exception) => !exception.requestId && !String(exception.id || '').startsWith(REQUEST_EXCEPTION_PREFIX));
  const canonical = approved.map((request) => exceptionFromApprovedRequest(request));
  const merged = [...unmanaged, ...canonical].filter((exception) => {
    if (!exception.requestId) return true;
    return approvedIds.has(exception.requestId);
  });
  return merged;
}

export function isLateOffRequest(request, reference = new Date()) {
  const type = request?.type;
  if (!['Off solicitado', 'Posible off'].includes(type)) return false;
  const created = new Date(request.createdAt || reference);
  const day = created.getDay();
  const hour = created.getHours();
  const isLateWindow = day > 4 || (day === 4 && hour >= 17);
  if (!isLateWindow) return false;
  const target = new Date(`${request.from || request.date}T00:00:00`);
  const diffDays = (target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 10;
}

export function currentMonthKey(reference = new Date()) {
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseFlexibleDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function filterRequestsToCurrentMonth(requests = [], reference = new Date()) {
  const monthKey = currentMonthKey(reference);
  return requests.filter((request) => {
    const date = parseFlexibleDate(request.from || request.date || request.createdAt);
    if (!date) return true;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return key === monthKey;
  });
}

export function filterExceptionsToCurrentMonth(exceptions = [], reference = new Date()) {
  const monthKey = currentMonthKey(reference);
  return exceptions.filter((exception) => {
    const date = parseFlexibleDate(exception.from || exception.date || exception.updatedAt);
    if (!date) return true;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return key === monthKey;
  });
}

export function requestStatusRank(status = '') {
  const normalized = String(status).toLowerCase();
  if (normalized.includes('aprob')) return 4;
  if (normalized.includes('rechaz')) return 4;
  if (normalized.includes('fuera')) return 3;
  if (normalized.includes('pend')) return 2;
  return 1;
}

export function mergeRequestsById(local = [], remote = []) {
  const byId = new Map();
  for (const item of remote) {
    if (item?.id) byId.set(item.id, { ...item });
  }
  for (const item of local) {
    if (!item?.id) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, { ...item });
      continue;
    }
    const localRank = requestStatusRank(item.status);
    const remoteRank = requestStatusRank(existing.status);
    const winner = localRank >= remoteRank ? item : existing;
    byId.set(item.id, { ...existing, ...winner, updatedAt: winner.updatedAt || existing.updatedAt });
  }
  return [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export { exceptionKind };
