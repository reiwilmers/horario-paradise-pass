import { describe, expect, it } from 'vitest';
import {
  localHasScheduleAuthority,
  mergeOperationalRemote,
  preserveLocalOperationalFields,
  shouldPreserveLocalSchedules,
  shouldPushLocalSchedules,
} from '../../domain/operationalMerge.js';

const REFERENCE = new Date('2026-07-28T12:00:00.000Z');
const CURRENT_MONDAY = '2026-07-27';
const PREVIOUS_MONDAY = '2026-07-20';

function scheduleForWeek(mondayIso, assignments) {
  return {
    mondayIso,
    days: assignments,
  };
}

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

    const merged = preserveLocalOperationalFields(remote, local, true, REFERENCE, true);
    expect(merged.salesTracking.byYear['2026'].ENE.lolo).toBe(99);
    expect(merged.monthlyGoals.byYear['2026'].AGO.lolo.opportunities).toEqual(['x']);
    expect(merged.forecasts.current[0].total).toBe(200);
    expect(merged.forecastSettings.qualificationPercent).toBe(0.7);
    expect(merged.updatedAt).toBe(remote.updatedAt);
  });

  it('keeps local dashboard schedule only during active editor session', () => {
    const remote = {
      updatedAt: '2026-07-26T12:00:00.000Z',
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['remote-agent'] } }),
      },
      morningWbdMap: { Lunes: ['remote-agent'] },
    };
    const local = {
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['local-agent'] } }),
      },
      morningWbdMap: { Lunes: ['local-agent'] },
    };

    const merged = mergeOperationalRemote(remote, local, {
      preserveRecentEdits: true,
      isScheduleEditor: true,
      reference: REFERENCE,
    });
    expect(merged.schedules.current.days.Lunes['8AM']).toEqual(['local-agent']);
    expect(merged.morningWbdMap.Lunes).toEqual(['local-agent']);
  });

  it('read-only clients always take remote schedules', () => {
    const remote = {
      updatedAt: '2026-07-28T03:00:00.000Z',
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8:50AM sala': ['rei', 'joan'] } }),
      },
      forecasts: { current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 100 }] },
      morningWbdMap: { Lunes: ['rei'] },
      visibleWeek: 'next',
    };
    const local = {
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8:50AM sala': ['barbie', 'yaque'] } }),
      },
      forecasts: { current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 90 }] },
      morningWbdMap: { Lunes: ['barbie'] },
    };

    expect(shouldPreserveLocalSchedules(local, remote, {
      isScheduleEditor: false,
      reference: REFERENCE,
    })).toBe(false);
    expect(shouldPushLocalSchedules(local, { isScheduleEditor: false, reference: REFERENCE })).toBe(false);

    const merged = mergeOperationalRemote(remote, local, {
      isScheduleEditor: false,
      reference: REFERENCE,
    });
    expect(merged.schedules.current.days.Lunes['8:50AM sala']).toEqual(['rei', 'joan']);
    expect(merged.visibleWeek).toBe('current');
  });

  it('accepts remote current-week schedule when local still has last week filled', () => {
    const remote = {
      updatedAt: '2026-07-28T03:00:00.000Z',
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8:50AM sala': ['rei', 'joan'] } }),
      },
      forecasts: { current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 100 }] },
      morningWbdMap: { Lunes: ['rei'] },
    };
    const local = {
      schedules: {
        current: scheduleForWeek(PREVIOUS_MONDAY, {
          Lunes: { '8:50AM sala': ['barbie', 'yaque', 'sebas', 'camila', 'bern', 'rei', 'felix'] },
        }),
      },
      forecasts: { current: [{ date: PREVIOUS_MONDAY, day: 'Lunes', total: 90 }] },
      morningWbdMap: { Lunes: ['barbie'] },
    };

    expect(shouldPreserveLocalSchedules(local, remote, { reference: REFERENCE })).toBe(false);
    expect(shouldPushLocalSchedules(local, { reference: REFERENCE })).toBe(false);

    const merged = mergeOperationalRemote(remote, local, { reference: REFERENCE });
    expect(merged.schedules.current.days.Lunes['8:50AM sala']).toEqual(['rei', 'joan']);
    expect(merged.morningWbdMap.Lunes).toEqual(['rei']);
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

  it('allows push when only next week has assignments', () => {
    const local = {
      schedules: {
        current: { mondayIso: '2026-07-27', days: {} },
        next: {
          mondayIso: '2026-08-03',
          days: { Lunes: { '8:50AM sala': ['rei'] } },
        },
      },
      forecasts: {
        current: [{ date: '2026-07-27' }],
        next: [{ date: '2026-08-03' }],
      },
    };
    expect(shouldPushLocalSchedules(local, {
      isScheduleEditor: true,
      reference: REFERENCE,
    })).toBe(true);
  });

  it('preserves next week local schedule during publisher edit session', () => {
    const remote = {
      updatedAt: '2026-07-26T12:00:00.000Z',
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['remote-agent'] } }),
        next: scheduleForWeek('2026-08-03', { Lunes: { '8AM': ['old-next'] } }),
      },
    };
    const local = {
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['local-agent'] } }),
        next: scheduleForWeek('2026-08-03', { Lunes: { '8AM': ['new-next'] } }),
      },
    };

    expect(shouldPreserveLocalSchedules(local, remote, {
      preserveRecentEdits: true,
      isScheduleEditor: true,
      reference: REFERENCE,
    })).toBe(true);
  });
});
