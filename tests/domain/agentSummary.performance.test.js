import { describe, expect, it } from 'vitest';
import { buildAgentWeekSummary, blockDisplayLabel } from '../../domain/agentSummary.js';
import {
  computeAgentLevelInsight,
  computeMonthStats,
  highlightClass,
  isAgentOnVacationInMonth,
  visibleMonthKeys,
} from '../../domain/performance.js';

describe('agentSummary', () => {
  it('labels blocks with area and visual time context', () => {
    expect(blockDisplayLabel('8:50AM')).toBe('8:50AM sala');
    expect(blockDisplayLabel('9AM')).toBe('9AM lobby');
    expect(blockDisplayLabel('Cierre Lobby')).toBe('Cierre lobby');
    expect(blockDisplayLabel('Cierre Sala')).toBe('Cierre sala');
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
    expect(summary[0].label).toBe('9AM lobby');
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

  it('shows only months up to current month for current year', () => {
    const months = visibleMonthKeys(new Date('2026-07-15T12:00:00'), 2026);
    expect(months).toEqual(['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL']);
    expect(months).not.toContain('AGO');
  });

  it('detects approved vacation overlap in month', () => {
    const onVacation = isAgentOnVacationInMonth('abel', 'JUL', 2026, [{
      applicantId: 'abel',
      type: 'Vacaciones',
      status: 'Aprobada',
      from: '2026-07-10',
      until: '2026-07-20',
    }]);
    expect(onVacation).toBe(true);
  });

  it('suggests downgrade after two weak months for TOP', () => {
    const agentsById = {
      julian: { id: 'julian', name: 'Julian', category: 'TOP', active: true },
      lolo: { id: 'lolo', name: 'Lolo', category: 'TOP', active: true },
    };
    const monthData = {
      JUN: { julian: 40, lolo: 100 },
      JUL: { julian: 42, lolo: 100 },
    };
    const insight = computeAgentLevelInsight(agentsById.julian, {
      monthData,
      visibleMonths: ['JUN', 'JUL'],
      year: 2026,
      requests: [],
      agentsById,
    });
    expect(insight.suggestion).toContain('MA');
  });
});
