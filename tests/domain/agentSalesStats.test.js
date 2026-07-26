import { describe, expect, it } from 'vitest';
import {
  buildAgentStatsSnapshot,
  buildJulyMonthCatchupEntry,
  buildPeriodRollup,
  buildWhatsAppStatsText,
  buildBulkRowEntry,
  datesInMonth,
  datesInWeek,
  defaultStatsDate,
  emptyAgentSalesStatsStore,
  entryHasSalesData,
  formatMetricLine,
  isJulyBulkCatchupActive,
  mondayOfIsoDate,
  normalizeDailySalesEntry,
  ratioPercent,
  rollupMetrics,
  syncMonthlyCertsFromStats,
} from '../../domain/agentSalesStats.js';
import { normalizeAgentMonthGoals } from '../../domain/monthlyGoals.js';

function sampleEntry(overrides = {}) {
  return normalizeDailySalesEntry({
    SALA: [10, 2, 1],
    LR: [8, 2, 1],
    OA: [0, 0, 0],
    LG: [0, 0, 0],
    LB: [3, 0, 0],
    Certs: 3,
    ...overrides,
  });
}

describe('agentSalesStats', () => {
  it('formats ratio metrics with percent', () => {
    expect(formatMetricLine('LR', { LR: [8, 2, 1] })).toBe('8/2/1 25%');
    expect(formatMetricLine('LB', { LB: [3, 0, 0] })).toBe('3/0 0%');
    expect(ratioPercent([8, 2, 1])).toBe(25);
  });

  it('rolls up daily entries across week and month boundaries', () => {
    const stats = emptyAgentSalesStatsStore(2026);
    stats.byYear['2026'] = {
      '2026-07-21': { agent1: sampleEntry({ Certs: 2 }) },
      '2026-07-22': { agent1: sampleEntry({ Certs: 1 }) },
      '2026-08-01': { agent1: sampleEntry({ Certs: 5 }) },
    };
    const week = buildPeriodRollup(stats, 'agent1', datesInWeek(mondayOfIsoDate('2026-07-22')));
    expect(week.Certs).toBe(3);
    const monthJul = buildPeriodRollup(stats, 'agent1', datesInMonth('JUL', 2026));
    expect(monthJul.Certs).toBe(3);
    const monthAug = buildPeriodRollup(stats, 'agent1', datesInMonth('AGO', 2026));
    expect(monthAug.Certs).toBe(5);
  });

  it('builds snapshot with goal pace and record comparison', () => {
    const stats = emptyAgentSalesStatsStore(2026);
    stats.byYear['2026'] = {
      '2026-07-26': { agent1: sampleEntry({ Certs: 4 }) },
    };
    const goals = normalizeAgentMonthGoals({
      certGoal: 130,
      records: {
        daily: { Certs: 3 },
        weekly: { Certs: 10 },
        monthly: { Certs: 100 },
      },
    });
    const snapshot = buildAgentStatsSnapshot({
      stats,
      agentId: 'agent1',
      isoDate: '2026-07-26',
      goals,
      year: 2026,
    });
    expect(snapshot.monthCerts).toBe(4);
    expect(snapshot.beatRecord.day).toBe('beat');
    expect(snapshot.certGoal).toBe(130);
    expect(snapshot.certsRemaining).toBe(126);
  });

  it('builds WhatsApp text in expected shape', () => {
    const stats = emptyAgentSalesStatsStore(2026);
    stats.byYear['2026'] = {
      '2026-07-26': { lolo: sampleEntry() },
    };
    const goals = normalizeAgentMonthGoals({ certGoal: 130 });
    const snapshot = buildAgentStatsSnapshot({
      stats,
      agentId: 'lolo',
      isoDate: '2026-07-26',
      goals,
      year: 2026,
    });
    const text = buildWhatsAppStatsText({ agentName: 'L0L0', snapshot });
    expect(text).toContain('L0L0');
    expect(text).toContain('DÍA');
    expect(text).toContain('Certs = 3');
    expect(text).toContain('Meta 130');
  });

  it('syncs monthly certs into sales tracking', () => {
    const stats = emptyAgentSalesStatsStore(2026);
    stats.byYear['2026'] = {
      '2026-07-26': { agent1: sampleEntry({ Certs: 7 }) },
    };
    const salesTracking = { year: 2026, byYear: { 2026: { JUL: {} } } };
    const next = syncMonthlyCertsFromStats(stats, salesTracking, 'agent1', '2026-07-26');
    expect(next.byYear['2026'].JUL.agent1).toBe(7);
  });

  it('sums ratio parts across entries', () => {
    const rollup = rollupMetrics([
      sampleEntry({ LR: [4, 1, 0], Certs: 2 }),
      sampleEntry({ LR: [4, 1, 1], Certs: 1 }),
    ]);
    expect(rollup.LR).toEqual([8, 2, 1]);
    expect(rollup.Certs).toBe(3);
  });

  it('detects july bulk catchup window through July 26 only', () => {
    expect(isJulyBulkCatchupActive(new Date('2026-07-26T12:00:00'))).toBe(true);
    expect(isJulyBulkCatchupActive(new Date('2026-07-27T12:00:00'))).toBe(false);
    expect(isJulyBulkCatchupActive(new Date('2026-08-01T12:00:00'))).toBe(false);
  });

  it('defaults stats date to July 27 during catchup window', () => {
    expect(defaultStatsDate(new Date('2026-07-26T12:00:00'))).toBe('2026-07-27');
    expect(defaultStatsDate(new Date('2026-07-27T12:00:00'))).toBe('2026-07-27');
  });

  it('builds july month catchup entry from month rollup', () => {
    const stats = emptyAgentSalesStatsStore(2026);
    stats.byYear['2026'] = {
      '2026-07-10': { agent1: sampleEntry({ Certs: 2, LR: [4, 1, 0] }) },
      '2026-07-20': { agent1: sampleEntry({ Certs: 3, LR: [4, 1, 1] }) },
    };
    const rollup = buildJulyMonthCatchupEntry(stats, 'agent1');
    expect(rollup.Certs).toBe(5);
    expect(rollup.LR).toEqual([8, 2, 1]);
  });

  it('builds bulk row entries from ratio strings', () => {
    const entry = buildBulkRowEntry({ LR: '8/2/1', Certs: 3 });
    expect(entry.LR).toEqual([8, 2, 1]);
    expect(entry.Certs).toBe(3);
    expect(entryHasSalesData(entry)).toBe(true);
  });
});
