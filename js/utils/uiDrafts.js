const HORARIO_SHARE_DRAFT_KEY = 'paradise-pass:horario-share';

function readStore() {
  try {
    return JSON.parse(sessionStorage.getItem(HORARIO_SHARE_DRAFT_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStore(next) {
  sessionStorage.setItem(HORARIO_SHARE_DRAFT_KEY, JSON.stringify(next));
}

export function readHorarioShareDraft() {
  return readStore();
}

export function patchHorarioShareDraft(patch = {}) {
  writeStore({ ...readStore(), ...patch });
}

export function captureHorarioShareDraft(container) {
  if (!container) return;
  const salaOp = container.querySelector('#horario-sala-op')?.value;
  const lobbyOp = container.querySelector('#horario-lobby-op')?.value;
  const shareDay = container.querySelector('#horario-share-day')?.value;
  const patch = {};
  if (salaOp != null) patch.salaOp = salaOp;
  if (lobbyOp != null) patch.lobbyOp = lobbyOp;
  if (shareDay) patch.shareDay = shareDay;
  if (Object.keys(patch).length) patchHorarioShareDraft(patch);
}

export function horarioShareDraftValues(container) {
  if (container) captureHorarioShareDraft(container);
  const stored = readHorarioShareDraft();
  return {
    shareDay: container?.dataset?.horarioShareDay || stored.shareDay || '',
    salaOp: stored.salaOp || container?.dataset?.horarioSalaOp || '',
    lobbyOp: stored.lobbyOp || container?.dataset?.horarioLobbyOp || '',
  };
}
