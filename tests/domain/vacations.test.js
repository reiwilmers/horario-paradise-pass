import { describe, expect, it } from 'vitest';
import {
  countInclusiveDays,
  agentVacationPeriods,
  totalVacationDays,
  isAgentOnVacationOnDate,
  formatVacationRange,
} from '../../domain/vacations.js';

describe('vacations domain', () => {
  it('counts inclusive vacation days', () => {
    expect(countInclusiveDays('2026-07-20', '2026-07-22')).toBe(3);
    expect(countInclusiveDays('2026-07-20', '2026-07-20')).toBe(1);
  });

  it('detects vacation on date from exceptions', () => {
    const exceptions = [{
      agentId: 'nelson',
      type: 'VACACIONES',
      from: '2026-07-20',
      until: '2026-07-26',
      active: true,
      status: 'Activa',
    }];
    expect(isAgentOnVacationOnDate('nelson', '2026-07-22', exceptions)).toBe(true);
    expect(isAgentOnVacationOnDate('nelson', '2026-07-27', exceptions)).toBe(false);
  });

  it('builds vacation periods and totals', () => {
    const exceptions = [{
      agentId: 'lolo',
      type: 'VACACIONES',
      from: '2026-07-01',
      until: '2026-07-05',
      active: true,
    }];
    const requests = [{
      applicantId: 'lolo',
      type: 'Vacaciones',
      from: '2026-08-10',
      until: '2026-08-12',
      status: 'Aprobada',
    }];
    const periods = agentVacationPeriods('lolo', exceptions, requests);
    expect(periods).toHaveLength(2);
    expect(totalVacationDays(periods)).toBe(8);
  });

  it('formats vacation range', () => {
    expect(formatVacationRange('2026-07-01', '2026-07-05')).toBe('2026-07-01 — 2026-07-05');
    expect(formatVacationRange('2026-07-01', '2026-07-01')).toBe('2026-07-01');
  });
});
