import { describe, expect, it } from 'vitest';
import {
  buildOperationalCloudState,
  shouldApplyRemoteOperational,
  scheduleHasAssignments,
  countOperationalAssignments,
  resolveScheduleMonday,
  isCurrentCalendarWeekSchedule,
  isStaleScheduleWeek,
  normalizeOperationalSchedules,
  OPERATIONAL_CLOUD_KEY,
} from '../../domain/cloudSync.js';

const REFERENCE = new Date('2026-07-28T12:00:00.000Z');
const CURRENT_MONDAY = '2026-07-27';
const PREVIOUS_MONDAY = '2026-07-20';

describe('cloudSync domain', () => {
  it('builds operational payload with schedules and agents', () => {
    const state = {
      schedules: { current: { weekKey: 'current', days: {} }, next: { weekKey: 'next', days: {} } },
      forecasts: { current: [], next: [] },
      morningWbdMap: { Lunes: [] },
      visibleWeek: 'current',
      forecastSettings: { qualificationPercent: 0.6 },
      forecastEditWeek: 'current',
      agents: { ids: ['a1'], byId: { a1: { id: 'a1', name: 'Test' } } },
      salesTracking: {},
      monthlyGoals: [],
    };
    const payload = buildOperationalCloudState(state, '2026-07-20T12:00:00.000Z');
    expect(payload.updatedAt).toBe('2026-07-20T12:00:00.000Z');
    expect(payload.schedules.current.weekKey).toBe('current');
    expect(payload.agents).toHaveLength(1);
    expect(payload.morningWbdMap.Lunes).toEqual([]);
  });

  it('applies remote when local timestamp is missing or older', () => {
    expect(shouldApplyRemoteOperational(null, { updatedAt: '2026-07-20T12:00:00.000Z' })).toBe(true);
    expect(shouldApplyRemoteOperational('2026-07-19T12:00:00.000Z', { updatedAt: '2026-07-20T12:00:00.000Z' })).toBe(true);
    expect(shouldApplyRemoteOperational('2026-07-21T12:00:00.000Z', { updatedAt: '2026-07-20T12:00:00.000Z' })).toBe(false);
  });

  it('counts assignments across schedules', () => {
    expect(countOperationalAssignments({
      schedules: {
        current: { days: { Lunes: { Sala: ['a1', 'a2'] } } },
        next: { days: { Martes: { Lobby: ['a3'] } } },
      },
    })).toBe(3);
  });

  it('detects schedule assignments for seed guard', () => {
    expect(scheduleHasAssignments({ days: { Lunes: { '8:50AM sala': ['a1'] } } })).toBe(true);
    expect(scheduleHasAssignments({ days: { Lunes: { '8:50AM sala': [] } } })).toBe(false);
  });

  it('uses stable operational cloud key', () => {
    expect(OPERATIONAL_CLOUD_KEY).toBe('paradise-pass-operational');
  });

  it('resolves schedule monday from forecast when mondayIso is missing', () => {
    const schedule = { days: { Lunes: { '8AM': ['a1'] } } };
    const forecasts = [{ date: CURRENT_MONDAY, day: 'Lunes', total: 1 }];
    expect(resolveScheduleMonday(schedule, forecasts)).toBe(CURRENT_MONDAY);
  });

  it('detects stale and current calendar weeks', () => {
    const stale = { mondayIso: PREVIOUS_MONDAY, days: {} };
    const current = { mondayIso: CURRENT_MONDAY, days: {} };
    expect(isStaleScheduleWeek(stale, [], REFERENCE)).toBe(true);
    expect(isCurrentCalendarWeekSchedule(current, [], REFERENCE)).toBe(true);
  });

  it('normalizes mondayIso when building cloud payload', () => {
    const state = {
      schedules: {
        current: { days: { Lunes: { '8AM': ['a1'] } } },
        next: { days: {} },
      },
      forecasts: {
        current: [{ date: CURRENT_MONDAY, day: 'Lunes', total: 1 }],
        next: [{ date: '2026-08-03', day: 'Lunes', total: 1 }],
      },
      morningWbdMap: {},
      visibleWeek: 'current',
      forecastSettings: {},
      forecastEditWeek: 'current',
      agents: { ids: [], byId: {} },
      salesTracking: {},
      monthlyGoals: [],
    };
    const payload = buildOperationalCloudState(state, '2026-07-28T03:00:00.000Z', REFERENCE);
    expect(payload.schedules.current.mondayIso).toBe(CURRENT_MONDAY);
    expect(normalizeOperationalSchedules(state.schedules, state.forecasts, REFERENCE).current.mondayIso)
      .toBe(CURRENT_MONDAY);
  });
});
