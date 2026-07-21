import { describe, expect, it } from 'vitest';
import { DAYS } from '../../domain/constants.js';
import {
  aggregateMonthlyDistribution,
  buildWeekSnapshot,
  currentMonthKey,
  incrementMetricsFromBlock,
  listAvailableMonthKeys,
  monthKeyFromDate,
  monthKeyLabel,
  shiftMonthKey,
  weekOverlapsMonth,
} from '../../domain/monthlyDistribution.js';

describe('monthlyDistribution domain', () => {
  const agentsById = {
    abel: { id: 'abel', name: 'Abel', category: 'MA', active: true },
    arturo: { id: 'arturo', name: 'Arturo', category: 'TOP', active: true },
  };

  const forecastRows = [
    { date: '2026-07-21' },
    { date: '2026-07-22' },
    { date: '2026-07-23' },
    { date: '2026-07-24' },
    { date: '2026-07-25' },
    { date: '2026-07-26' },
    { date: '2026-07-27' },
  ];

  const empty = { '8:50AM': [], '7:00AM': [], '8AM': [], '9AM': [], 'Cierre Lobby': [], 'Cierre Sala': [], 'WBD 5:30PM': [], 'Posible Off': [], Off: [] };
  const scheduleDays = Object.fromEntries(DAYS.map((day, index) => {
    if (index === 0) return [day, { ...empty, '9AM': ['abel'], '7:00AM': ['arturo'] }];
    if (index === 1) return [day, { ...empty, Off: ['abel'] }];
    return [day, { ...empty }];
  }));

  it('labels and shifts month keys', () => {
    expect(monthKeyFromDate('2026-07-21')).toBe('2026-07');
    expect(monthKeyLabel('2026-07')).toMatch(/julio/i);
    expect(shiftMonthKey('2026-07', 1)).toBe('2026-08');
    expect(shiftMonthKey('2026-07', -1)).toBe('2026-06');
  });

  it('detects week overlap with month', () => {
    expect(weekOverlapsMonth('2026-07-21', '2026-07')).toBe(true);
    expect(weekOverlapsMonth('2026-07-28', '2026-07')).toBe(true);
    expect(weekOverlapsMonth('2026-08-04', '2026-07')).toBe(false);
  });

  it('increments block metrics', () => {
    const metrics = { sala: 0, lobby: 0, cierreSala: 0, cierreLobby: 0, cierre: 0, abre: 0, wbdEvening: 0, posibleOff: 0, off: 0, assignedDays: 0 };
    incrementMetricsFromBlock(metrics, '9AM');
    incrementMetricsFromBlock(metrics, '7:00AM');
    incrementMetricsFromBlock(metrics, 'Off');
    expect(metrics.sala).toBe(0);
    expect(metrics.lobby).toBe(2);
    expect(metrics.abre).toBe(1);
    expect(metrics.off).toBe(1);
    expect(metrics.assignedDays).toBe(3);
  });

  it('aggregates monthly totals from snapshots', () => {
    const snapshot = buildWeekSnapshot({
      mondayIso: '2026-07-21',
      scheduleDays,
      forecastRows,
      morningWbdMap: { Lunes: ['abel'] },
    });

    const rows = aggregateMonthlyDistribution('2026-07', {
      snapshots: { '2026-07-21': snapshot },
      schedules: {},
      forecasts: {},
      morningWbdMap: {},
      agentsById,
      exceptions: [],
    });

    const abel = rows.find((row) => row.agentId === 'abel');
    const arturo = rows.find((row) => row.agentId === 'arturo');

    expect(abel.sala).toBe(0);
    expect(abel.lobby).toBe(1);
    expect(abel.wbdMorning).toBe(1);
    expect(abel.off).toBe(1);
    expect(abel.assignedDays).toBe(2);
    expect(arturo.abre).toBe(1);
    expect(arturo.assignedDays).toBe(1);
  });

  it('lists available months from snapshots and current month', () => {
    const snapshots = {
      '2026-07-21': buildWeekSnapshot({
        mondayIso: '2026-07-21',
        scheduleDays,
        forecastRows,
        morningWbdMap: {},
      }),
    };
    const keys = listAvailableMonthKeys(snapshots, new Date('2026-08-15T12:00:00'));
    expect(keys).toContain('2026-07');
    expect(keys).toContain('2026-08');
    expect(keys.at(-1)).toBe('2026-08');
  });

  it('uses current month key helper', () => {
    expect(currentMonthKey(new Date('2026-07-21T12:00:00'))).toBe('2026-07');
  });
});
