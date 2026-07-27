export function viewHasFocusedInput(root) {
  if (!root) return false;
  const active = document.activeElement;
  if (!active || !root.contains(active)) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const NON_TYPING_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'hidden',
  'image',
]);

/** True when the user is typing in a field that would lose value on re-render. */
export function viewHasTypingInput(root) {
  if (!root) return false;
  const active = document.activeElement;
  if (!active || !root.contains(active)) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'SELECT') return false;
  if (tag !== 'INPUT') return false;
  return !NON_TYPING_INPUT_TYPES.has(String(active.type || 'text').toLowerCase());
}

export function readInputValue(input) {
  if (!input) return '';
  if (input.type === 'checkbox' || input.type === 'radio') return input.checked ? '1' : '';
  return String(input.value ?? '');
}

export function captureDraftFromRoot(root, selector = 'input, textarea, select') {
  if (!root) return {};
  const draft = {};
  root.querySelectorAll(selector).forEach((element) => {
    if (!element.id && !element.name && element.dataset.draftKey == null) return;
    const key = element.dataset.draftKey || element.id || element.name;
    if (!key) return;
    draft[key] = readInputValue(element);
  });
  return draft;
}

export function restoreDraftToRoot(root, draft, selector = 'input, textarea, select') {
  if (!root || !draft) return;
  root.querySelectorAll(selector).forEach((element) => {
    const key = element.dataset.draftKey || element.id || element.name;
    if (!key || !(key in draft)) return;
    const value = draft[key];
    if (element.type === 'checkbox' || element.type === 'radio') {
      element.checked = value === '1' || value === 'true';
      return;
    }
    element.value = value;
  });
}

export function draftHasValues(draft) {
  if (!draft) return false;
  return Object.values(draft).some((value) => String(value || '').trim() !== '');
}

const OPERATIONAL_PAGES = new Set(['dashboard', 'horario', 'revision']);
const DRAFT_MANAGED_PAGES = new Set(['resumen', 'metas', 'solicitudes']);

/**
 * Operational views (schedule) must always re-render after sync.
 * Draft-managed views handle their own partial updates.
 * Other views block only while the user is typing in text fields.
 */
export function shouldBlockViewRender(page, root) {
  if (!root || !viewHasFocusedInput(root)) return false;
  if (OPERATIONAL_PAGES.has(page)) return false;
  if (DRAFT_MANAGED_PAGES.has(page)) return true;
  return viewHasTypingInput(root);
}
