import { describe, expect, it } from 'vitest';
import { shouldApplyRemoteOperationalState } from '../../domain/operationalSync.js';

const REFERENCE = new Date('2026-07-28T12:00:00.000Z');
const CURRENT_MONDAY = '2026-07-27';
const PREVIOUS_MONDAY = '2026-07-20';

function scheduleForWeek(mondayIso, assignments) {
  return { mondayIso, days: assignments };
}

describe('operationalSync domain', () => {
  it('read-only clients apply remote when cloud is newer', () => {
    const local = {
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['old-agent'] } }),
      },
      forecasts: { current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 1 }] },
    };
    const remote = {
      updatedAt: '2026-07-28T12:00:00.000Z',
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['new-agent'] } }),
      },
      forecasts: { current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 1 }] },
    };

    expect(shouldApplyRemoteOperationalState(local, remote, {
      localUpdatedAt: '2026-07-27T12:00:00.000Z',
      isScheduleEditor: false,
      reference: REFERENCE,
    })).toBe(true);
  });

  it('read-only clients apply remote when local week is stale', () => {
    const local = {
      schedules: {
        current: scheduleForWeek(PREVIOUS_MONDAY, { Lunes: { '8AM': ['old-agent'] } }),
      },
      forecasts: { current: [{ date: PREVIOUS_MONDAY, day: 'Lunes', total: 1 }] },
    };
    const remote = {
      updatedAt: '2026-07-28T12:00:00.000Z',
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['new-agent'] } }),
      },
      forecasts: { current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 1 }] },
    };

    expect(shouldApplyRemoteOperationalState(local, remote, {
      localUpdatedAt: '2026-07-28T11:00:00.000Z',
      isScheduleEditor: false,
      reference: REFERENCE,
    })).toBe(true);
  });

  it('read-only clients skip remote when local is current and cloud is older', () => {
    const local = {
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['local-agent'] } }),
      },
      forecasts: { current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 1 }] },
    };
    const remote = {
      updatedAt: '2026-07-27T12:00:00.000Z',
      schedules: {
        current: scheduleForWeek(CURRENT_MONDAY, { Lunes: { '8AM': ['remote-agent'] } }),
      },
      forecasts: { current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 1 }] },
    };

    expect(shouldApplyRemoteOperationalState(local, remote, {
      localUpdatedAt: '2026-07-28T12:00:00.000Z',
      isScheduleEditor: false,
      reference: REFERENCE,
    })).toBe(false);
  });
});
