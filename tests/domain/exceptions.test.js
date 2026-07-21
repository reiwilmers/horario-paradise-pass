import { describe, expect, it } from 'vitest';
import {
  exceptionApplies,
  exceptionBlockFor,
  exceptionTypeToBlock,
} from '../../domain/exceptions.js';
import { applyExceptionsToScheduleDays } from '../../domain/scheduleExceptions.js';
import { emptyWeekDays } from '../../domain/schedule.js';

describe('exceptions domain', () => {
  it('maps exception type to schedule block', () => {
    expect(exceptionTypeToBlock('OFF_SOLICITADO')).toBe('Off');
    expect(exceptionTypeToBlock('POSIBLE_OFF_SOLICITADO')).toBe('Posible Off');
  });

  it('applies off exception on matching date', () => {
    const exception = {
      agentId: 'lolo',
      type: 'OFF_SOLICITADO',
      from: '2026-07-21',
      until: '2026-07-21',
      active: true,
      status: 'Activa',
    };
    expect(exceptionApplies(exception, '2026-07-21')).toBe(true);
    expect(exceptionBlockFor('lolo', '2026-07-21', [exception])).toBe('Off');
  });

  it('does not force vacation agents into Off block', () => {
    const exception = {
      agentId: 'nelson',
      type: 'VACACIONES',
      from: '2026-07-21',
      until: '2026-07-26',
      active: true,
      status: 'Activa',
    };
    expect(exceptionTypeToBlock('VACACIONES')).toBe('');
    expect(exceptionBlockFor('nelson', '2026-07-22', [exception])).toBe('');
  });

  it('removes vacation agents from schedule without placing them in Off', () => {
    const days = emptyWeekDays();
    days.Lunes.Off = ['nelson'];
    days.Lunes['9AM'] = ['lolo'];
    const forecast = [{ day: 'Lunes', date: '2026-07-21' }];
    const exceptions = [{
      agentId: 'nelson',
      type: 'VACACIONES',
      from: '2026-07-21',
      until: '2026-07-26',
      active: true,
      status: 'Activa',
    }];
    const next = applyExceptionsToScheduleDays(days, forecast, exceptions);
    expect(next.Lunes.Off).not.toContain('nelson');
  });

  it('applies exceptions to schedule days', () => {
    const days = emptyWeekDays();
    days.Lunes['9AM'] = ['lolo'];
    const forecast = [{ day: 'Lunes', date: '2026-07-21' }];
    const exceptions = [{
      agentId: 'lolo',
      type: 'OFF_SOLICITADO',
      from: '2026-07-21',
      until: '2026-07-21',
      active: true,
      status: 'Activa',
    }];
    const next = applyExceptionsToScheduleDays(days, forecast, exceptions);
    expect(next.Lunes.Off).toContain('lolo');
    expect(next.Lunes['9AM']).not.toContain('lolo');
  });
});
