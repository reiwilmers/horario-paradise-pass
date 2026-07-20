import { pushToast } from '../store.js';

export function showError(message) {
  pushToast({ type: 'error', message });
  globalThis.alert?.(message);
}

export function showSuccess(message) {
  pushToast({ type: 'success', message });
}
