import { parseException, filterExceptionsToCurrentMonth } from '../../domain/requests.js';
import { dedupeExceptionsByRequest } from '../../domain/exceptions.js';
import {
  getState,
  upsertException,
  setExceptions,
  isAdminUser,
} from '../store.js';
import { persistException, persistAllExceptions } from './persist.js';
import { showError, showSuccess } from '../utils/toast.js';

export async function saveManualException(raw) {
  if (!isAdminUser()) {
    showError('Solo SUP/GTE pueden crear excepciones.');
    return { ok: false, code: 'FORBIDDEN' };
  }

  const parsed = parseException({
    ...raw,
    createdFromRequest: false,
    updatedAt: new Date().toISOString(),
  });
  if (!parsed.ok) {
    showError(parsed.errors.join(', '));
    return parsed;
  }

  upsertException(parsed.value);
  await persistException(parsed.value);
  showSuccess('Excepción guardada.');
  return { ok: true, value: parsed.value };
}

export async function deactivateException(exceptionId) {
  if (!isAdminUser()) {
    showError('Solo SUP/GTE pueden desactivar excepciones.');
    return { ok: false, code: 'FORBIDDEN' };
  }

  const existing = getState().exceptions.find((item) => item.id === exceptionId);
  if (!existing) {
    showError('Excepción no encontrada.');
    return { ok: false, code: 'NOT_FOUND' };
  }

  const updated = {
    ...existing,
    active: false,
    status: 'Inactiva',
    updatedAt: new Date().toISOString(),
  };
  upsertException(updated);
  await persistException(updated);
  showSuccess('Excepción desactivada.');
  return { ok: true, value: updated };
}

export function visibleExceptions() {
  return filterExceptionsToCurrentMonth(getState().exceptions);
}

export async function replaceExceptions(next = []) {
  const deduped = dedupeExceptionsByRequest(next);
  setExceptions(deduped);
  await persistAllExceptions();
  return deduped;
}
