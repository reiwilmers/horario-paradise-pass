import { describe, expect, it } from 'vitest';
import {
  countLobbyAssignedForDay,
  dayForecastContext,
} from '../../js/views/dashboard-forecast-strip.js';

describe('dashboard forecast strip', () => {
  it('counts lobby assignments for a day', () => {
    const dayPlan = {
      '7:00AM': ['a'],
      '8AM': ['b', 'c'],
      '9AM': ['d'],
      '8:50AM': ['e'],
      'Cierre Lobby': [],
    };
    expect(countLobbyAssignedForDay(dayPlan)).toBe(4);
  });

  it('builds forecast context with lobby tone', () => {
    const context = dayForecastContext({
      forecastRow: { total: 150, lobby: 6, level: 'Medio' },
      settings: { qualificationPercent: 0.6, shotsPerAgent: 15 },
      scheduleDay: { '8AM': ['a'], '9AM': ['b'] },
    });
    expect(context.total).toBe(150);
    expect(context.realExits).toBe(90);
    expect(context.lobbyTarget).toBe(6);
    expect(context.lobbyAssigned).toBe(2);
    expect(context.lobbyTone).toBe('low');
    expect(context.hasForecast).toBe(true);
  });

  it('marks lobby tone high when over suggested', () => {
    const context = dayForecastContext({
      forecastRow: { total: 120, lobby: 3, level: 'Fuerte' },
      settings: { qualificationPercent: 0.6, shotsPerAgent: 15 },
      scheduleDay: {
        '7:00AM': ['a'],
        '8AM': ['b'],
        '9AM': ['c', 'd'],
        'Cierre Lobby': ['e'],
      },
    });
    expect(context.lobbyAssigned).toBe(5);
    expect(context.lobbyTone).toBe('high');
  });
});
