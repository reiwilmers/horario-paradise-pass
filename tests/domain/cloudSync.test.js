import { describe, expect, it } from 'vitest';
import {
  buildOperationalCloudState,
  shouldApplyRemoteOperational,
  scheduleHasAssignments,
  OPERATIONAL_CLOUD_KEY,
} from '../../domain/cloudSync.js';

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
    expect(shouldApplyRemoteOperational(null, { updatedAt: '2026-07-20T12:00:00.000Z' }, false)).toBe(true);
    expect(shouldApplyRemoteOperational(null, { updatedAt: '2026-07-20T12:00:00.000Z' }, true)).toBe(false);
    expect(shouldApplyRemoteOperational('2026-07-19T12:00:00.000Z', { updatedAt: '2026-07-20T12:00:00.000Z' })).toBe(true);
    expect(shouldApplyRemoteOperational('2026-07-21T12:00:00.000Z', { updatedAt: '2026-07-20T12:00:00.000Z' })).toBe(false);
  });

  it('detects schedule assignments for seed guard', () => {
    expect(scheduleHasAssignments({ days: { Lunes: { '8:50AM sala': ['a1'] } } })).toBe(true);
    expect(scheduleHasAssignments({ days: { Lunes: { '8:50AM sala': [] } } })).toBe(false);
  });

  it('uses stable operational cloud key', () => {
    expect(OPERATIONAL_CLOUD_KEY).toBe('paradise-pass-operational');
  });
});
