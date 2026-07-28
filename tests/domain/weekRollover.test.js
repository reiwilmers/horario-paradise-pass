import { describe, expect, it } from 'vitest';
import { emptyWeekDays } from '../../domain/schedule.js';
import { buildForecastRows } from '../../domain/forecast.js';
import { applyWeekRollover, needsWeekRollover } from '../../domain/weekRollover.js';

const mondayJuly28 = new Date('2026-07-28T12:00:00');
const mondayJuly21 = new Date('2026-07-21T12:00:00');

function scheduleWithAgent(agentId, weekKey = 'current', mondayIso = '') {
  const days = emptyWeekDays();
  days.Lunes['9AM'] = [agentId];
  return { weekKey, mondayIso, days, updatedAt: '2026-07-27T12:00:00.000Z' };
}

describe('weekRollover', () => {
  it('detects when stored current week is behind the calendar', () => {
    const state = {
      schedules: {
        current: scheduleWithAgent('lolo', 'current', '2026-07-21'),
        next: scheduleWithAgent('felix', 'next', '2026-07-28'),
      },
      forecasts: {
        current: buildForecastRows('current', mondayJuly21, [{ day: 'Lunes', total: 10 }]),
        next: buildForecastRows('next', mondayJuly21, [{ day: 'Lunes', total: 20 }]),
      },
    };
    expect(needsWeekRollover(state, mondayJuly28)).toBe(true);
  });

  it('promotes next week into current on monday rollover', () => {
    const state = {
      schedules: {
        current: scheduleWithAgent('old-agent', 'current', '2026-07-21'),
        next: scheduleWithAgent('new-agent', 'next', '2026-07-28'),
      },
      forecasts: {
        current: buildForecastRows('current', mondayJuly21, [{ day: 'Lunes', total: 10 }]),
        next: buildForecastRows('next', mondayJuly21, [{ day: 'Lunes', total: 99 }]),
      },
    };

    const result = applyWeekRollover(state, mondayJuly28);
    expect(result.rotated).toBe(true);
    expect(result.schedules.current.days.Lunes['9AM']).toEqual(['new-agent']);
    expect(result.schedules.current.mondayIso).toBe('2026-07-27');
    expect(result.schedules.next.days.Lunes['9AM']).toEqual([]);
    expect(result.forecasts.current[0].date).toBe('2026-07-27');
    expect(result.forecasts.current[0].total).toBe(99);
    expect(result.forecasts.next[0].date).toBe('2026-08-03');
    expect(result.forecasts.next[0].total).toBe('');
  });

  it('realigns current in place when user already moved work to current and next is empty', () => {
    const state = {
      schedules: {
        current: scheduleWithAgent('fixed-agent', 'current', '2026-07-21'),
        next: { weekKey: 'next', mondayIso: '', days: emptyWeekDays(), updatedAt: '' },
      },
      forecasts: {
        current: buildForecastRows('current', mondayJuly21, [{ day: 'Lunes', total: 55 }]),
        next: buildForecastRows('next', mondayJuly21, []),
      },
    };

    const result = applyWeekRollover(state, mondayJuly28);
    expect(result.rotated).toBe(false);
    expect(result.realigned).toBe(true);
    expect(result.schedules.current.days.Lunes['9AM']).toEqual(['fixed-agent']);
    expect(result.schedules.current.mondayIso).toBe('2026-07-27');
    expect(result.forecasts.current[0].date).toBe('2026-07-27');
    expect(result.forecasts.current[0].total).toBe(55);
    expect(result.schedules.next.days.Lunes['9AM']).toEqual([]);
  });

  it('does not wipe a filled current week when forecasts are stale but schedule is already on calendar week', () => {
    const state = {
      schedules: {
        current: scheduleWithAgent('fixed-agent', 'current', '2026-07-27'),
        next: { weekKey: 'next', mondayIso: '', days: emptyWeekDays(), updatedAt: '' },
      },
      forecasts: {
        current: buildForecastRows('current', mondayJuly21, [{ day: 'Lunes', total: 55 }]),
        next: buildForecastRows('next', mondayJuly21, []),
      },
    };

    const result = applyWeekRollover(state, mondayJuly28);
    expect(result.rotated).toBe(false);
    expect(result.realigned).toBe(true);
    expect(result.schedules.current.days.Lunes['9AM']).toEqual(['fixed-agent']);
    expect(result.schedules.current.mondayIso).toBe('2026-07-27');
    expect(result.forecasts.current[0].date).toBe('2026-07-27');
  });

  it('does not rollover when current already matches the calendar week', () => {
    const state = {
      schedules: {
        current: scheduleWithAgent('lolo', 'current', '2026-07-27'),
        next: { weekKey: 'next', mondayIso: '2026-08-03', days: emptyWeekDays(), updatedAt: '' },
      },
      forecasts: {
        current: buildForecastRows('current', mondayJuly28, [{ day: 'Lunes', total: 12 }]),
        next: buildForecastRows('next', mondayJuly28, []),
      },
    };
    expect(needsWeekRollover(state, mondayJuly28)).toBe(false);
  });
});
