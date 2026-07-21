import {
  parseRequest,
  isLateOffRequest,
  filterRequestsForInbox,
} from '../../domain/requests.js';
import {
  getState,
  upsertRequest,
  currentUser,
  isAdminUser,
} from '../store.js';
import { persistRequest } from './persist.js';
import { syncApprovedPipeline } from './approved.js';
import { showError, showSuccess } from '../utils/toast.js';

export async function createRequest(raw) {
  const user = currentUser();
  if (!user) {
    showError('Selecciona tu usuario en la barra lateral.');
    return { ok: false, errors: ['no user'] };
  }

  const payload = {
    ...raw,
    applicantId: raw.applicantId || user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'Pendiente',
  };

  const parsed = parseRequest(payload);
  if (!parsed.ok) {
    showError(parsed.errors.join(', '));
    return parsed;
  }

  let request = parsed.value;
  if (isLateOffRequest(request)) {
    request = {
      ...request,
      status: 'Fuera de tiempo',
      specialApproval: true,
    };
  }

  upsertRequest(request);
  await persistRequest(request);
  showSuccess('Solicitud enviada.');
  return { ok: true, value: request };
}

export async function updateRequestStatus(requestId, status) {
  if (!isAdminUser()) {
    showError('Solo SUP/GTE pueden aprobar o rechazar.');
    return { ok: false, code: 'FORBIDDEN' };
  }

  const request = getState().requests.find((item) => item.id === requestId);
  if (!request) {
    showError('Solicitud no encontrada.');
    return { ok: false, code: 'NOT_FOUND' };
  }

  const updated = {
    ...request,
    status,
    updatedAt: new Date().toISOString(),
  };
  upsertRequest(updated);
  await persistRequest(updated);
  await syncApprovedPipeline();
  showSuccess(`Solicitud ${status.toLowerCase()}.`);
  return { ok: true, value: updated };
}

export function visibleRequests() {
  const all = filterRequestsForInbox(getState().requests);
  const user = currentUser();
  if (isAdminUser()) return all;
  if (!user) return [];
  return all.filter((request) => request.applicantId === user.id);
}
