import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRequest, updateRequestStatus } from '../../js/actions/requests.js';
import { getState, resetStore, loadAgents, setCurrentUserId } from '../../js/store.js';
import { SEED_AGENTS } from '../../js/seed-data.js';

vi.mock('../../js/db.js', () => ({
  put: vi.fn(async () => {}),
  putMany: vi.fn(async () => {}),
  setSetting: vi.fn(async () => {}),
}));

vi.mock('../../js/cloud.js', () => ({
  queueCloudSync: vi.fn(),
}));

vi.mock('../../js/actions/persist.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    persistRequest: vi.fn(async () => {}),
    persistAllExceptions: vi.fn(async () => {}),
    persistSchedule: vi.fn(async () => {}),
  };
});

describe('request actions', () => {
  beforeEach(() => {
    resetStore();
    loadAgents(SEED_AGENTS);
    setCurrentUserId('lolo', true);
    vi.stubGlobal('alert', vi.fn());
  });

  it('creates request for current user', async () => {
    const result = await createRequest({
      type: 'Off solicitado',
      from: '2026-07-25',
      until: '2026-07-25',
      reason: 'Personal',
    });
    expect(result.ok).toBe(true);
    expect(getState().requests[0].applicantId).toBe('lolo');
  });

  it('allows admin to approve request', async () => {
    setCurrentUserId('rei', true);
    await createRequest({
      type: 'Off solicitado',
      from: '2026-07-25',
      until: '2026-07-25',
      reason: 'Personal',
    });
    const requestId = getState().requests[0].id;
    const result = await updateRequestStatus(requestId, 'Aprobada');
    expect(result.ok).toBe(true);
    expect(getState().requests[0].status).toBe('Aprobada');
    expect(getState().exceptions.some((ex) => ex.requestId === requestId)).toBe(true);
  });

  it('blocks non-admin approval', async () => {
    await createRequest({
      type: 'Off solicitado',
      from: '2026-07-25',
      until: '2026-07-25',
      reason: 'Personal',
    });
    const requestId = getState().requests[0].id;
    const result = await updateRequestStatus(requestId, 'Aprobada');
    expect(result.ok).toBe(false);
  });
});
