import { describe, expect, it } from 'vitest';
import {
  buildForecastRows,
  calculateLobbySuggested,
  calculateRealExits,
  enrichForecastLobby,
  syncForecastsToCalendar,
  forecastMatchesCalendar,
} from '../../domain/forecast.js';

const REF = new Date('2026-07-20T12:00:00');

describe('forecast domain', () => {
  it('calculates real exits at 60%', () => {
    expect(calculateRealExits(100, { qualificationPercent: 0.6 })).toBe(60);
  });

  it('calculates lobby suggested from total and shots', () => {
    expect(calculateLobbySuggested(150, { qualificationPercent: 0.6, shotsPerAgent: 15 })).toBe(6);
  });

  it('builds 7 calendar rows with ISO dates', () => {
    const rows = buildForecastRows('current', REF, []);
    expect(rows).toHaveLength(7);
    expect(rows[0].day).toBe('Lunes');
    expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rows[6].day).toBe('Domingo');
  });

  it('preserves totals when syncing calendar', () => {
    const seed = buildForecastRows('current', REF, [{ total: 120, lobby: 5 }]);
    seed[0].total = 120;
    seed[0].lobby = 5;
    const synced = syncForecastsToCalendar({ current: seed, next: [] }, REF);
    expect(synced.current[0].total).toBe(120);
    expect(synced.current[0].lobby).toBe(5);
    expect(forecastMatchesCalendar(synced.current, 'current', REF)).toBe(true);
  });

  it('enriches lobby from totals when missing', () => {
    const rows = enrichForecastLobby(
      [{ day: 'Lunes', total: 150, lobby: '' }],
      { qualificationPercent: 0.6, shotsPerAgent: 15 },
    );
    expect(rows[0].lobby).toBe(6);
  });
});
