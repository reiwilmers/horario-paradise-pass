export function viewHasFocusedInput(root) {
  if (!root) return false;
  const active = document.activeElement;
  if (!active || !root.contains(active)) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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
