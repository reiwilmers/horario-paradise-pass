import { describe, expect, it } from 'vitest';
import {
  parseRequest,
  parseException,
  requestTypeToExceptionType,
  exceptionFromApprovedRequest,
  syncExceptionsFromRequests,
  isLateOffRequest,
  filterRequestsToCurrentMonth,
  filterExceptionsToCurrentMonth,
} from '../../domain/requests.js';

describe('requests domain', () => {
  it('parses valid off request', () => {
    const result = parseRequest({
      applicantId: 'lolo',
      type: 'Off solicitado',
      from: '2026-07-25',
      until: '2026-07-25',
      reason: 'Personal',
    });
    expect(result.ok).toBe(true);
    expect(result.value.applicantId).toBe('lolo');
  });

  it('maps request type to exception type', () => {
    expect(requestTypeToExceptionType('Vacaciones')).toBe('VACACIONES');
    expect(requestTypeToExceptionType('Posible off')).toBe('POSIBLE_OFF_SOLICITADO');
  });

  it('builds exception from approved request', () => {
    const request = {
      id: 'req-1',
      applicantId: 'lau',
      type: 'Off solicitado',
      from: '2026-07-22',
      until: '2026-07-22',
      reason: 'Cita médica',
      status: 'Aprobada',
    };
    const exception = exceptionFromApprovedRequest(request);
    expect(exception.type).toBe('OFF_SOLICITADO');
    expect(exception.agentId).toBe('lau');
    expect(exception.active).toBe(true);
  });

  it('syncs exceptions from approved requests only', () => {
    const requests = [
      { id: 'r1', applicantId: 'lolo', type: 'Off solicitado', from: '2026-07-20', status: 'Aprobada', reason: 'x' },
      { id: 'r2', applicantId: 'felix', type: 'Off solicitado', from: '2026-07-21', status: 'Pendiente', reason: 'y' },
    ];
    const synced = syncExceptionsFromRequests(requests, []);
    expect(synced).toHaveLength(1);
    expect(synced[0].requestId).toBe('r1');
  });

  it('flags late off request after Thursday 5pm', () => {
    const request = {
      type: 'Off solicitado',
      from: '2026-07-22',
      createdAt: '2026-07-17T18:00:00',
    };
    expect(isLateOffRequest(request, new Date('2026-07-17T18:00:00'))).toBe(true);
  });

  it('filters requests to current month', () => {
    const ref = new Date('2026-07-15T12:00:00');
    const filtered = filterRequestsToCurrentMonth([
      { from: '2026-07-10', createdAt: '2026-07-10' },
      { from: '2026-06-10', createdAt: '2026-06-10' },
    ], ref);
    expect(filtered).toHaveLength(1);
  });

  it('filters exceptions overlapping current month', () => {
    const ref = new Date('2026-07-15T12:00:00');
    const filtered = filterExceptionsToCurrentMonth([
      { from: '2026-07-10', until: '2026-07-12' },
      { from: '2026-06-28', until: '2026-07-03' },
      { from: '2026-08-01', until: '2026-08-05' },
    ], ref);
    expect(filtered).toHaveLength(2);
  });

  it('parses manual exception', () => {
    const result = parseException({
      agentId: 'lau',
      type: 'VACACIONES',
      from: '2026-07-01',
      until: '2026-07-05',
      detail: 'Viaje',
    });
    expect(result.ok).toBe(true);
    expect(result.value.agentId).toBe('lau');
  });
});
