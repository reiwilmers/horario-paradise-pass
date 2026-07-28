import { describe, expect, it, vi, beforeEach } from 'vitest';
import { placeAgent, removeAgent } from '../../js/actions/schedule.js';
import { loadAgents, getState, resetStore, loadSchedule } from '../../js/store.js';
import { SEED_AGENTS } from '../../js/seed-data.js';
import { emptyWeekDays } from '../../domain/schedule.js';
import { patchScheduleDays } from '../../js/store.js';

vi.mock('../../js/actions/persist.js', () => ({
  persistSchedule: vi.fn(async () => {}),
  persistMorningWbdMap: vi.fn(async () => {}),
  persistScheduleLearning: vi.fn(async () => {}),
}));

describe('schedule actions', () => {
  beforeEach(() => {
    resetStore();
    loadAgents(SEED_AGENTS);
    patchScheduleDays('current', emptyWeekDays());
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('places agent in valid block', async () => {
    const result = await placeAgent('current', 'Lunes', '9AM', 'lolo');
    expect(result.ok).toBe(true);
    expect(getState().schedules.current.days.Lunes['9AM']).toContain('lolo');
  });

  it('rejects invalid assignment (Lau 8AM weekday)', async () => {
    const result = await placeAgent('current', 'Lunes', '8AM', 'lau');
    expect(result.ok).toBe(false);
    expect(getState().schedules.current.days.Lunes['8AM']).not.toContain('lau');
  });

  it('rejects SUP in 7:00AM', async () => {
    const result = await placeAgent('current', 'Lunes', '7:00AM', 'rei');
    expect(result.ok).toBe(false);
  });

  it('removes agent from block', async () => {
    await placeAgent('current', 'Lunes', '9AM', 'felix');
    await removeAgent('current', 'Lunes', '9AM', 'felix');
    expect(getState().schedules.current.days.Lunes['9AM']).not.toContain('felix');
  });

  it('records manual placement for schedule learning', async () => {
    await placeAgent('current', 'Lunes', '9AM', 'lolo');
    expect(getState().scheduleLearning.events).toHaveLength(1);
    expect(getState().scheduleLearning.events[0]).toMatchObject({
      agentId: 'lolo',
      day: 'Lunes',
      toBlock: '9AM',
      weekKey: 'current',
    });
  });

  it('allows manual placement beyond block capacity', async () => {
    const block = '8AM';
    const ids = ['lolo', 'felix', 'abel', 'arturo', 'camila'];
    for (const id of ids) {
      await placeAgent('current', 'Sabado', block, id);
    }
    const result = await placeAgent('current', 'Sabado', block, 'rai');
    expect(result.ok).toBe(true);
    expect(getState().schedules.current.days.Sabado[block]).toContain('rai');
    expect(getState().schedules.current.days.Sabado[block].length).toBe(6);
  });

  it('strips unknown agents instead of rejecting the whole week', () => {
    loadAgents(SEED_AGENTS);
    const days = emptyWeekDays();
    days.Lunes['8:50AM'] = ['rei', 'joan'];
    const result = loadSchedule('current', {
      weekKey: 'current',
      mondayIso: '2026-07-27',
      days,
    });
    expect(result.ok).toBe(true);
    expect(getState().schedules.current.days.Lunes['8:50AM']).toEqual(['rei']);
  });

  it('reloads schedules saved above block capacity', () => {
    loadAgents([
      ...SEED_AGENTS,
      {
        id: 'alexis',
        name: 'Alexis',
        category: 'MB',
        active: true,
        morningWbdEligible: false,
        eveningWbdEligible: true,
        rules: { priorityArea: 'BALANCE' },
      },
      {
        id: 'joan',
        name: 'Joan',
        category: 'TOP',
        active: true,
        morningWbdEligible: true,
        eveningWbdEligible: true,
        rules: { priorityArea: 'BALANCE' },
      },
    ]);
    const days = emptyWeekDays();
    days.Lunes['8:50AM'] = ['rei', 'berno', 'camila', 'alexis', 'arturo', 'lolo', 'joan'];
    const result = loadSchedule('current', {
      weekKey: 'current',
      mondayIso: '2026-07-27',
      days,
    });
    expect(result.ok).toBe(true);
    expect(getState().schedules.current.days.Lunes['8:50AM']).toEqual([
      'rei', 'berno', 'camila', 'alexis', 'arturo', 'lolo', 'joan',
    ]);
  });
});
