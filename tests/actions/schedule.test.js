import { describe, expect, it, vi, beforeEach } from 'vitest';
import { placeAgent, removeAgent } from '../../js/actions/schedule.js';
import { loadAgents, getState, resetStore } from '../../js/store.js';
import { SEED_AGENTS } from '../../js/seed-data.js';
import { emptyWeekDays } from '../../domain/schedule.js';
import { patchScheduleDays } from '../../js/store.js';

vi.mock('../../js/actions/persist.js', () => ({
  persistSchedule: vi.fn(async () => {}),
  persistMorningWbdMap: vi.fn(async () => {}),
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
});
