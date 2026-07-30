import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../js/cloud.js', () => ({
  pullCloudState: vi.fn(async () => false),
  pushLocalIfRicher: vi.fn(async () => false),
  fetchRemoteOperational: vi.fn(async () => null),
  isCloudEnabled: vi.fn(() => true),
}));

vi.mock('../../js/actions/forecast.js', () => ({
  syncForecastCalendar: vi.fn(async () => ({ changed: false, rotated: false })),
}));

vi.mock('../../js/actions/approved.js', () => ({
  syncApprovedPipeline: vi.fn(async () => {}),
}));

vi.mock('../../js/actions/persist.js', () => ({
  persistVisibleWeek: vi.fn(async () => {}),
}));

vi.mock('../../js/store.js', () => ({
  getState: vi.fn(() => ({ visibleWeek: 'current' })),
  setVisibleWeek: vi.fn(),
}));

import {
  pullCloudState,
  pushLocalIfRicher,
  fetchRemoteOperational,
  isCloudEnabled,
} from '../../js/cloud.js';
import { syncForecastCalendar } from '../../js/actions/forecast.js';
import { syncApprovedPipeline } from '../../js/actions/approved.js';
import { runSyncLifecycle, getLastSyncLifecycleAt } from '../../js/syncLifecycle.js';

describe('syncLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCloudEnabled.mockReturnValue(true);
  });

  it('runs pull, rollover, push, and pipeline in order when cloud is enabled', async () => {
    const order = [];
    pullCloudState.mockImplementation(async () => {
      order.push('pull');
      return true;
    });
    syncForecastCalendar.mockImplementation(async () => {
      order.push('rollover');
      return { changed: true, rotated: false };
    });
    fetchRemoteOperational.mockImplementation(async () => {
      order.push('fetch');
      return { updatedAt: '2026-07-28T12:00:00.000Z' };
    });
    pushLocalIfRicher.mockImplementation(async () => {
      order.push('push');
      return false;
    });
    syncApprovedPipeline.mockImplementation(async () => {
      order.push('pipeline');
    });

    const result = await runSyncLifecycle({ reason: 'init' });

    expect(order).toEqual(['pull', 'rollover', 'fetch', 'push', 'pipeline']);
    expect(pullCloudState).toHaveBeenCalledWith({
      notify: false,
      reference: expect.any(Date),
      syncPipeline: false,
    });
    expect(result.changed).toBe(true);
    expect(getLastSyncLifecycleAt()).toBeGreaterThan(0);
  });

  it('only runs rollover when cloud is disabled', async () => {
    isCloudEnabled.mockReturnValue(false);
    syncForecastCalendar.mockResolvedValue({ changed: true, rotated: false });

    const result = await runSyncLifecycle({ reason: 'init' });

    expect(pullCloudState).not.toHaveBeenCalled();
    expect(syncForecastCalendar).toHaveBeenCalled();
    expect(result.cloudEnabled).toBe(false);
    expect(result.changed).toBe(true);
  });

  it('debounces rapid lifecycle calls', async () => {
    await runSyncLifecycle({ reason: 'init' });
    vi.clearAllMocks();

    const skipped = await runSyncLifecycle({ reason: 'visible' });
    expect(skipped.skipped).toBe(true);
    expect(pullCloudState).not.toHaveBeenCalled();
  });
});
