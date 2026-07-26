import { describe, expect, it } from 'vitest';
import {
  buildCoachRequestPayload,
  MIN_REFLECTION_LENGTH,
} from '../../domain/coachProvider.js';

describe('coachProvider', () => {
  it('rejects short reflections', () => {
    const result = buildCoachRequestPayload({
      agentName: 'L0L0',
      isoDate: '2026-07-26',
      reflection: 'corto',
      snapshot: {},
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain(String(MIN_REFLECTION_LENGTH));
  });

  it('builds a user message for valid reflections', () => {
    const result = buildCoachRequestPayload({
      agentName: 'L0L0',
      isoDate: '2026-07-26',
      reflection: 'No vendí el primer shot porque me dijeron que no viajan tan seguido.',
      scenario: 'SALA',
      snapshot: {
        day: { Certs: 1 },
        week: { Certs: 3 },
        month: { Certs: 10 },
        certGoal: 130,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.userMessage).toContain('L0L0');
    expect(result.userMessage).toContain('Escenario: SALA');
    expect(result.userMessage).toContain('no viajan tan seguido');
  });
});
