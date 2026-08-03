import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../js/db.js', () => ({
  getSetting: vi.fn(async () => null),
  setSetting: vi.fn(async () => {}),
}));

vi.mock('../../js/store.js', () => ({
  getState: vi.fn(() => ({
    schedules: {
      current: { mondayIso: '2026-07-27', days: {} },
      next: {
        mondayIso: '2026-08-03',
        days: { Lunes: { '8:50AM sala': ['rei', 'joan'] } },
      },
    },
    forecasts: { current: [], next: [] },
    agents: { ids: ['rei'], byId: { rei: { id: 'rei', name: 'Rei' } } },
    visibleWeek: 'next',
  })),
  currentUser: vi.fn(() => ({ id: 'rei', name: 'Rei' })),
  hydrateFromDb: vi.fn(() => []),
  loadRequests: vi.fn(),
  loadExceptions: vi.fn(),
}));

vi.mock('../../js/actions/persist.js', () => ({
  persistOperationalLocal: vi.fn(async () => {}),
  persistAllRequests: vi.fn(async () => {}),
  persistAllExceptions: vi.fn(async () => {}),
}));

vi.mock('../../js/utils/fetchRetry.js', () => ({
  fetchWithRetry: vi.fn(),
}));

vi.mock('../../js/config.js', () => ({
  SUPABASE_ENABLED: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-key',
}));

import { fetchWithRetry } from '../../js/utils/fetchRetry.js';
import { syncCloudNow, queueOperationalCloudSync } from '../../js/cloud.js';
import { currentUser, getState } from '../../js/store.js';

describe('cloud publisher guards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const cloud = await import('../../js/cloud.js');
    await cloud.loadCloudConfig();
    await cloud.clearOperationalDirty();
  });

  it('rejects manual sync for non-publisher users', async () => {
    currentUser.mockReturnValue({ id: 'lolo', name: 'Lolo' });
    const result = await syncCloudNow({ notify: false });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('FORBIDDEN');
    expect(fetchWithRetry).not.toHaveBeenCalled();
  });

  it('verifies cloud payload after publisher manual sync', async () => {
    currentUser.mockReturnValue({ id: 'rei', name: 'Rei' });
    const state = getState();
    const payload = {
      updatedAt: '2026-08-02T12:00:00.000Z',
      publisherAgentId: 'rei',
      schedules: state.schedules,
      forecasts: state.forecasts,
    };

    fetchWithRetry
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ value: payload }]), { status: 200 }));

    const result = await syncCloudNow({ notify: false });
    expect(result.ok).toBe(true);
    expect(fetchWithRetry).toHaveBeenCalledTimes(2);
  });

  it('blocks queued operational sync for read-only users', () => {
    currentUser.mockReturnValue({ id: 'cris', name: 'Cris', category: 'GTE' });
    queueOperationalCloudSync(getState());
    expect(fetchWithRetry).not.toHaveBeenCalled();
  });
});
