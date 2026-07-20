import { describe, expect, it } from 'vitest';
import { buildAgentWeekSummary, blockDisplayLabel } from '../../domain/agentSummary.js';
import { computeMonthStats, highlightClass } from '../../domain/performance.js';

describe('agentSummary', () => {
  it('labels blocks with visual time', () => {
    expect(blockDisplayLabel('Cierre Lobby')).toBe('Cierre Lobby (10AM)');
  });

  it('summarizes an agent week with WBD flag', () => {
    const empty = { '8:50AM': [], '7:00AM': [], '8AM': [], '9AM': [], 'Cierre Lobby': [], 'Cierre Sala': [], 'WBD 5:30PM': [], 'Posible Off': [], Off: [] };
    const scheduleDays = {
      Lunes: { ...empty, '9AM': ['abel'] },
      Martes: empty,
      Miercoles: empty,
      Jueves: empty,
      Viernes: empty,
      Sabado: empty,
      Domingo: empty,
    };
    const summary = buildAgentWeekSummary(scheduleDays, 'abel', { morningWbdMap: { Lunes: ['abel'] } });
    expect(summary[0].label).toBe('9AM');
    expect(summary[0].wbd).toBe(true);
    expect(summary[1].label).toBe('Sin asignar');
  });
});

describe('performance', () => {
  it('computes average and pct vs average', () => {
    const stats = computeMonthStats({ a: 100, b: 80 });
    expect(stats.average).toBe(90);
    expect(stats.pctByAgent.a).toBe(11);
    expect(stats.pctByAgent.b).toBe(-11);
    expect(stats.max).toBe(100);
    expect(stats.min).toBe(80);
  });

  it('highlights max and min cells', () => {
    const stats = computeMonthStats({ a: 100, b: 80 });
    expect(highlightClass(100, stats)).toBe('performance-cell--max');
    expect(highlightClass(80, stats)).toBe('performance-cell--min');
    expect(highlightClass(90, stats)).toBe('');
  });
});
