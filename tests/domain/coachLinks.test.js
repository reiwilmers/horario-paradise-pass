import { describe, expect, it } from 'vitest';
import { COACH_GPT_URL, COACH_SHARE_TEXT } from '../../domain/coachLinks.js';

describe('coachLinks', () => {
  it('points to the Coach Paradise Pass GPT', () => {
    expect(COACH_GPT_URL).toContain('coach-paradise-pass');
  });

  it('includes a prompt scaffold for sellers', () => {
    expect(COACH_SHARE_TEXT).toContain('SALA');
    expect(COACH_SHARE_TEXT).toContain('Caso del día');
  });
});
