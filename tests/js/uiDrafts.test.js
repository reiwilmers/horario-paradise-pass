import { describe, expect, it, beforeEach } from 'vitest';
import {
  patchHorarioShareDraft,
  readHorarioShareDraft,
  horarioShareDraftValues,
} from '../../js/utils/uiDrafts.js';

describe('uiDrafts horario share', () => {
  beforeEach(() => {
    global.sessionStorage = {
      store: {},
      getItem(key) {
        return this.store[key] ?? null;
      },
      setItem(key, value) {
        this.store[key] = value;
      },
      clear() {
        this.store = {};
      },
    };
    sessionStorage.clear();
  });

  it('persists sala and lobby opportunity values', () => {
    patchHorarioShareDraft({ salaOp: '12', lobbyOp: '8', shareDay: 'LUN' });
    expect(readHorarioShareDraft()).toEqual({ salaOp: '12', lobbyOp: '8', shareDay: 'LUN' });
  });

  it('reads draft values from session storage when container is empty', () => {
    patchHorarioShareDraft({ salaOp: '5', lobbyOp: '3' });
    const values = horarioShareDraftValues(null);
    expect(values.salaOp).toBe('5');
    expect(values.lobbyOp).toBe('3');
  });
});
