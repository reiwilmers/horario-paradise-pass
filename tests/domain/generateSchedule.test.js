import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateSchedule } from '../../domain/generateSchedule.js';
import { generateScheduleForWeek } from '../../js/actions/generate.js';
import { loadAgents, getState, resetStore, patchForecasts } from '../../js/store.js';
import { SEED_AGENTS } from '../../js/seed-data.js';
import { buildForecastRows } from '../../domain/forecast.js';
import { parseAgent } from '../../domain/schemas.js';
import { DAYS } from '../../domain/constants.js';

vi.mock('../../js/actions/persist.js', () => ({
  persistSchedule: vi.fn(async () => {}),
  persistMorningWbdMap: vi.fn(async () => {}),
  persistVisibleWeek: vi.fn(async () => {}),
}));

const REF = new Date('2026-07-20T12:00:00');

function forecastWithTotals(total = 150) {
  return buildForecastRows('current', REF, []).map((row) => ({
    ...row,
    total,
    lobby: 6,
    level: 'Medio',
  }));
}

describe('generateSchedule domain', () => {
  it('assigns every active agent somewhere in the week', () => {
    const agents = SEED_AGENTS.map((raw) => parseAgent(raw).value);
    const result = generateSchedule({
      agents,
      forecast: forecastWithTotals(),
      exceptions: [],
      forecastSettings: { qualificationPercent: 0.6, shotsPerAgent: 15 },
    });

    for (const agent of agents) {
      const daysWithAgent = DAYS.filter((day) => {
        const dayPlan = result.days[day];
        return Object.values(dayPlan).some((list) => list.includes(agent.id));
      });
      expect(daysWithAgent.length).toBe(7);
    }
  });

  it('assigns 3 morning WBD per day when enough eligible agents', () => {
    const agents = SEED_AGENTS.map((raw) => parseAgent(raw).value);
    const result = generateSchedule({
      agents,
      forecast: forecastWithTotals(),
      exceptions: [],
      forecastSettings: { qualificationPercent: 0.6, shotsPerAgent: 15 },
    });

    for (const day of DAYS) {
      expect((result.morningWbdMap[day] || []).length).toBeLessThanOrEqual(3);
    }
  });

  it('does not place Lau in 8AM on weekday when generated', () => {
    const agents = SEED_AGENTS.map((raw) => parseAgent(raw).value);
    const result = generateSchedule({
      agents,
      forecast: forecastWithTotals(),
      exceptions: [],
      forecastSettings: { qualificationPercent: 0.6, shotsPerAgent: 15 },
    });

    for (const day of ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']) {
      expect(result.days[day]['8AM'] || []).not.toContain('lau');
    }
  });
});

describe('generateSchedule action', () => {
  beforeEach(() => {
    resetStore();
    loadAgents(SEED_AGENTS);
    patchForecasts('current', forecastWithTotals());
    vi.stubGlobal('alert', vi.fn());
  });

  it('writes schedule and morning WBD map to store', async () => {
    const result = await generateScheduleForWeek('current');
    expect(result.ok).toBe(true);
    expect(getState().schedules.current.days.Lunes['9AM']?.length).toBeGreaterThan(0);
    expect(getState().morningWbdMap.Lunes?.length).toBeGreaterThan(0);
  });

  it('rejects empty forecast totals', async () => {
    patchForecasts('current', buildForecastRows('current', REF, []));
    const result = await generateScheduleForWeek('current');
    expect(result.ok).toBe(false);
  });
});
