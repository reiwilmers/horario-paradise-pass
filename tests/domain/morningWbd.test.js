import { describe, expect, it } from 'vitest';
import {
  activeMorningWbdIds,
  pruneMorningWbdForDay,
  pruneMorningWbdMapGlobal,
} from '../../domain/morningWbd.js';
import { emptyWeekDays } from '../../domain/schedule.js';

describe('morningWbd', () => {
  it('prunes WBD ids not in morning lobby blocks', () => {
    const dayPlan = { '9AM': ['rai'], '8:50AM sala': ['lolo'] };
    expect(pruneMorningWbdForDay(['rai', 'lolo', 'ghost'], dayPlan)).toEqual(['rai']);
  });

  it('counts only active WBD for a day', () => {
    const map = { Lunes: ['rai', 'lolo', 'ghost'] };
    const dayPlan = { '8AM': ['lolo'] };
    expect(activeMorningWbdIds(map, 'Lunes', dayPlan)).toEqual(['lolo']);
  });

  it('keeps WBD when agent is in lobby in either week', () => {
    const currentDays = emptyWeekDays();
    const nextDays = emptyWeekDays();
    nextDays.Martes['7:00AM'] = ['abel'];
    const pruned = pruneMorningWbdMapGlobal(
      { Martes: ['abel', 'ghost'] },
      { current: { days: currentDays }, next: { days: nextDays } },
    );
    expect(pruned.Martes).toEqual(['abel']);
  });
});
