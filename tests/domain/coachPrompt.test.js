import { describe, expect, it } from 'vitest';
import { buildCoachUserMessage, COACH_GPT_URL, COACH_SYSTEM_PROMPT } from '../../domain/coachPrompt.js';
import { normalizeDailySalesEntry } from '../../domain/agentSalesStats.js';

describe('coachPrompt', () => {
  it('includes the elite coach identity in the system prompt', () => {
    expect(COACH_SYSTEM_PROMPT).toContain('Coach Paradise Pass Elite');
    expect(COACH_GPT_URL).toContain('coach-paradise-pass');
  });

  it('builds a user message with stats and reflection', () => {
    const message = buildCoachUserMessage({
      agentName: 'L0L0',
      isoDate: '2026-07-26',
      scenario: 'SALA',
      reflection: 'No vendí el primer shot porque me dijeron que no viajan tan seguido.',
      snapshot: {
        day: { SALA: [8, 2, 1], LR: [0, 0, 0], OA: [0, 0, 0], LG: [0, 0, 0], LB: [0, 0, 0], Certs: 1 },
        week: { Certs: 3 },
        month: { Certs: 10 },
        certGoal: 130,
      },
    });
    expect(message).toContain('Vendedor: L0L0');
    expect(message).toContain('Escenario: SALA');
    expect(message).toContain('no viajan tan seguido');
    expect(message).toContain('Meta mensual de certificados: 130');
  });

  it('normalizes reflection and coach opened timestamp on daily entries', () => {
    const entry = normalizeDailySalesEntry({
      Certs: 2,
      reflection: 'Caso del lobby.',
      scenario: 'LOBBY',
      coachOpenedAt: '2026-07-26T12:00:00.000Z',
    });
    expect(entry.reflection).toBe('Caso del lobby.');
    expect(entry.scenario).toBe('LOBBY');
    expect(entry.coachOpenedAt).toContain('2026-07-26');
  });
});
