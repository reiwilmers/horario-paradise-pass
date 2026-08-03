import { describe, expect, it } from 'vitest';
import { verifyOperationalPayload } from '../../domain/operationalVerify.js';

describe('operationalVerify', () => {
  it('accepts matching current and next week schedules', () => {
    const payload = {
      updatedAt: '2026-08-02T12:00:00.000Z',
      publisherAgentId: 'rei',
      schedules: {
        current: {
          mondayIso: '2026-07-27',
          days: { Lunes: { '8:50AM sala': ['rei'] } },
        },
        next: {
          mondayIso: '2026-08-03',
          days: { Martes: { '8:50AM sala': ['joan', 'alexis'] } },
        },
      },
    };
    const result = verifyOperationalPayload(payload, structuredClone(payload));
    expect(result.ok).toBe(true);
  });

  it('rejects when next week assignments differ', () => {
    const expected = {
      updatedAt: '2026-08-02T12:00:00.000Z',
      schedules: {
        current: { mondayIso: '2026-07-27', days: {} },
        next: {
          mondayIso: '2026-08-03',
          days: { Martes: { '8:50AM sala': ['joan'] } },
        },
      },
    };
    const remote = structuredClone(expected);
    remote.schedules.next.days.Martes['8:50AM sala'] = ['alexis'];
    const result = verifyOperationalPayload(expected, remote);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SCHEDULE_MISMATCH');
    expect(result.weekKey).toBe('next');
  });
});
