import { describe, expect, it } from 'vitest';
import {
  localHasScheduleAuthority,
  mergeOperationalRemote,
  preserveLocalOperationalFields,
} from '../../domain/operationalMerge.js';

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

  it('always keeps local dashboard schedule when this device has assignments', () => {
    const remote = {
      updatedAt: '2026-07-26T12:00:00.000Z',
      schedules: { current: { days: { Lunes: { '8AM': ['remote-agent'] } } } },
      morningWbdMap: { Lunes: ['remote-agent'] },
    };
    const local = {
      schedules: { current: { days: { Lunes: { '8AM': ['local-agent'] } } } },
      morningWbdMap: { Lunes: ['local-agent'] },
    };

    const merged = mergeOperationalRemote(remote, local, { preserveRecentEdits: false });
    expect(merged.schedules.current.days.Lunes['8AM']).toEqual(['local-agent']);
    expect(merged.morningWbdMap.Lunes).toEqual(['local-agent']);
  });

  it('accepts remote schedule when local dashboard is still empty', () => {
    const remote = {
      schedules: { current: { days: { Lunes: { '8AM': ['remote-agent'] } } } },
    };
    const local = {
      schedules: { current: { days: {} }, next: { days: {} } },
    };
    expect(localHasScheduleAuthority(local)).toBe(false);
    const merged = mergeOperationalRemote(remote, local);
    expect(merged.schedules.current.days.Lunes['8AM']).toEqual(['remote-agent']);
  });

  it('returns remote payload unchanged when not preserving local edits and no schedule authority', () => {
    const remote = { salesTracking: { year: 2026 }, forecasts: { current: [] } };
    const local = { salesTracking: { year: 2027 }, forecasts: { current: [{ total: 9 }] } };
    expect(preserveLocalOperationalFields(remote, local, false)).toEqual(remote);
  });
});
