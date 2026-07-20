import { pushToast as storePushToast, dismissToast, clearToasts } from '../store.js';

const DISMISS_MS = {
  success: 2800,
  error: 4500,
};

function scheduleDismiss(id, type) {
  const timer = globalThis.setTimeout ?? globalThis.window?.setTimeout;
  if (typeof timer !== 'function') return;
  timer(() => dismissToast(id), DISMISS_MS[type] || 3500);
}

export function showError(message) {
  const id = storePushToast({ type: 'error', message });
  scheduleDismiss(id, 'error');
}

export function showSuccess(message) {
  const id = storePushToast({ type: 'success', message });
  scheduleDismiss(id, 'success');
}

export { clearToasts };
