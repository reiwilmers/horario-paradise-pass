import { describe, expect, it } from 'vitest';
import {
  appendScheduleLearningEvent,
  buildLearningProfile,
  getLearningScoreBoost,
  learningSummary,
  normalizeScheduleLearningStore,
} from '../../domain/scheduleLearning.js';

describe('scheduleLearning domain', () => {
  it('ignores no-op adjustments', () => {
    const store = appendScheduleLearningEvent(
      { version: 1, events: [] },
      { agentId: 'lolo', day: 'Lunes', fromBlock: '9AM', toBlock: '9AM' },
    );
    expect(store.events).toHaveLength(0);
  });

  it('builds weighted profile from manual edits', () => {
    const now = Date.now();
    const profile = buildLearningProfile([
      {
        agentId: 'lolo',
        day: 'Lunes',
        toBlock: '9AM',
        toArea: 'LOBBY',
        at: now,
      },
    ]);
    expect(profile.eventCount).toBe(1);
    expect(getLearningScoreBoost('lolo', '9AM', 'Lunes', profile)).toBeGreaterThan(0);
  });

  it('caps learning boost', () => {
    const now = Date.now();
    const events = Array.from({ length: 20 }, (_, index) => ({
      agentId: 'lolo',
      day: 'Lunes',
      toBlock: '9AM',
      toArea: 'LOBBY',
      at: now - index * 1000,
    }));
    const profile = buildLearningProfile(events);
    expect(getLearningScoreBoost('lolo', '9AM', 'Lunes', profile)).toBeLessThanOrEqual(45);
  });

  it('summarizes learning for generation notice', () => {
    const profile = buildLearningProfile([
      { agentId: 'lolo', day: 'Lunes', toBlock: '9AM', toArea: 'LOBBY', at: Date.now() },
      { agentId: 'felix', day: 'Martes', toBlock: '8:50AM', toArea: 'SALA', at: Date.now() },
    ]);
    expect(learningSummary(profile)).toContain('2 ajustes');
    expect(learningSummary(buildLearningProfile([]))).toBe('');
  });

  it('normalizes invalid store payloads', () => {
    expect(normalizeScheduleLearningStore(null).events).toEqual([]);
    expect(normalizeScheduleLearningStore({ events: [{ agentId: 'x' }] }).events).toEqual([]);
  });
});
