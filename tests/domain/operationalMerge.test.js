import { describe, expect, it } from 'vitest';
import { preserveLocalOperationalFields } from '../../domain/operationalMerge.js';

describe('operationalMerge domain', () => {
  it('keeps local editable fields when requested', () => {
    const remote = {
      updatedAt: '2026-07-26T12:00:00.000Z',
      salesTracking: { year: 2026, byYear: { 2026: { ENE: { lolo: 1 } } } },
      monthlyGoals: { year: 2026, byYear: { 2026: {} } },
      forecasts: { current: [{ day: 'Lunes', total: 1 }], next: [] },
      forecastSettings: { qualificationPercent: 0.5 },
    };
    const local = {
      salesTracking: { year: 2026, byYear: { 2026: { ENE: { lolo: 99 } } } },
      monthlyGoals: { year: 2026, byYear: { 2026: { AGO: { lolo: { opportunities: ['x'] } } } } },
      forecasts: { current: [{ day: 'Lunes', total: 200 }], next: [] },
      forecastSettings: { qualificationPercent: 0.7 },
    };

    const merged = preserveLocalOperationalFields(remote, local, true);
    expect(merged.salesTracking.byYear['2026'].ENE.lolo).toBe(99);
    expect(merged.monthlyGoals.byYear['2026'].AGO.lolo.opportunities).toEqual(['x']);
    expect(merged.forecasts.current[0].total).toBe(200);
    expect(merged.forecastSettings.qualificationPercent).toBe(0.7);
    expect(merged.updatedAt).toBe(remote.updatedAt);
  });

  it('keeps local schedules during recent edit window', () => {
    const remote = {
      updatedAt: '2026-07-26T12:00:00.000Z',
      schedules: { current: { days: { Lunes: { '8AM': ['a'] } } } },
    };
    const local = {
      schedules: { current: { days: { Lunes: { '8AM': ['b'] } } } },
    };
    const merged = preserveLocalOperationalFields(remote, local, true);
    expect(merged.schedules.current.days.Lunes['8AM']).toEqual(['b']);
  });

  it('returns remote payload unchanged when not preserving local edits', () => {
    const remote = { salesTracking: { year: 2026 }, forecasts: { current: [] } };
    const local = { salesTracking: { year: 2027 }, forecasts: { current: [{ total: 9 }] } };
    expect(preserveLocalOperationalFields(remote, local, false)).toEqual(remote);
  });
});
