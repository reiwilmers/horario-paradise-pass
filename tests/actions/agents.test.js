import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  setAgentCategory,
  setAgentWbdFlags,
  setAgentRules,
  setAgentActive,
} from '../../js/actions/agents.js';
import { loadAgents, getState, resetStore } from '../../js/store.js';
import { SEED_AGENTS } from '../../js/seed-data.js';
import { countSpecialRules } from '../../domain/agents.js';
import { computeWeeklyDistribution } from '../../domain/distribution.js';
import { emptyWeekDays } from '../../domain/schedule.js';
import { sortAgentsForPerformanceView, computeAnnualTotals, visibleMonthKeys } from '../../domain/performance.js';

vi.mock('../../js/db.js', () => ({
  put: vi.fn(async () => {}),
}));

vi.mock('../../js/cloud.js', () => ({
  queueOperationalCloudSync: vi.fn(),
}));

describe('agent actions', () => {
  beforeEach(() => {
    resetStore();
    loadAgents(SEED_AGENTS);
    vi.stubGlobal('alert', vi.fn());
  });

  it('changes category with one click', async () => {
    const result = await setAgentCategory('lolo', 'TOP');
    expect(result.ok).toBe(true);
    expect(getState().agents.byId.lolo.category).toBe('TOP');
  });

  it('propagates category changes to all modules via store', async () => {
    await setAgentCategory('lolo', 'MB');
    const agent = getState().agents.byId.lolo;
    expect(agent.category).toBe('MB');

    const [distributionRow] = computeWeeklyDistribution(emptyWeekDays(), getState().agents.byId)
      .filter((row) => row.agent.id === 'lolo');
    expect(distributionRow.agent.category).toBe('MB');

    const sorted = sortAgentsForPerformanceView(
      [agent],
      computeAnnualTotals([agent], {}, visibleMonthKeys(new Date(), 2026), 2026, []),
    );
    expect(sorted[0].category).toBe('MB');
  });

  it('updates WBD flags independently', async () => {
    await setAgentWbdFlags('lolo', { morningWbdEligible: false });
    expect(getState().agents.byId.lolo.morningWbdEligible).toBe(false);
    expect(getState().agents.byId.lolo.eveningWbdEligible).toBe(true);

    await setAgentWbdFlags('lolo', { eveningWbdEligible: false });
    expect(getState().agents.byId.lolo.eveningWbdEligible).toBe(false);
  });

  it('merges structured special rules', async () => {
    await setAgentRules('lau', {
      lobbyWeekdaysOnly9AM: true,
      maxLobbyPerWeek: 2,
      fixedOffDays: ['Sabado', 'Domingo'],
    });
    const lau = getState().agents.byId.lau;
    expect(lau.rules.lobbyWeekdaysOnly9AM).toBe(true);
    expect(lau.rules.maxLobbyPerWeek).toBe(2);
    expect(lau.rules.fixedOffDays).toEqual(['Sabado', 'Domingo']);
    expect(countSpecialRules(lau)).toBeGreaterThan(0);
  });

  it('deactivates agent without removing from store', async () => {
    await setAgentActive('lolo', false);
    expect(getState().agents.byId.lolo.active).toBe(false);
    expect(getState().agents.byId.lolo).toBeTruthy();
  });
});

describe('agent domain helpers', () => {
  it('counts special rules for Lau-like profile', () => {
    const lau = SEED_AGENTS.find((agent) => agent.id === 'lau');
    expect(countSpecialRules(lau)).toBeGreaterThan(0);
  });
});
