import { describe, expect, it } from 'vitest';
import { computeWeeklyDistribution, isPoolBlock, agentsOnVacationForWeek } from '../../domain/distribution.js';

describe('distribution', () => {
  it('detects pool blocks', () => {
    expect(isPoolBlock('Off')).toBe(true);
    expect(isPoolBlock('Posible Off')).toBe(true);
    expect(isPoolBlock('9AM')).toBe(false);
  });

  it('counts weekly sala, lobby, wbd and off assignments', () => {
    const agentsById = {
      abel: { id: 'abel', name: 'Abel', active: true, category: 'MA' },
    };
    const empty = { '8:50AM': [], '7:00AM': [], '8AM': [], '9AM': [], 'Cierre Lobby': [], 'Cierre Sala': [], 'WBD 5:30PM': [], 'Posible Off': [], Off: [] };
    const scheduleDays = {
      Lunes: { ...empty, '9AM': ['abel'] },
      Martes: { ...empty, 'Cierre Sala': ['abel'] },
      Miercoles: { ...empty, 'WBD 5:30PM': ['abel'] },
      Jueves: { ...empty, Off: ['abel'] },
      Viernes: empty,
      Sabado: empty,
      Domingo: empty,
    };
    const morningWbdMap = { Lunes: ['abel'], Martes: [] };
    const [row] = computeWeeklyDistribution(scheduleDays, agentsById, morningWbdMap);
    expect(row.lobby).toBe(1);
    expect(row.cierre).toBe(1);
    expect(row.wbdMorning).toBe(1);
    expect(row.wbdEvening).toBe(1);
    expect(row.off).toBe(1);
  });

  it('builds vacation row when exception overlaps forecast dates', () => {
    const exceptions = [{
      type: 'VACACIONES',
      agentId: 'nelson',
      from: '2026-07-20',
      until: '2026-08-07',
      active: true,
    }];
    const forecastRows = [
      { date: '2026-07-20' },
      { date: '2026-07-21' },
      {}, {}, {}, {}, {},
    ];
    const result = agentsOnVacationForWeek(exceptions, forecastRows);
    expect(result?.Lunes).toEqual(['nelson']);
    expect(result?.Martes).toEqual(['nelson']);
  });
});
