import { describe, expect, it } from 'vitest';
import {
  buildMeasurableItems,
  computeAnnualGoalSummary,
  computeMonthCompletion,
  computeProgress,
  getAgentMonthGoals,
  goalTrackingMonthKeys,
  normalizeAgentMonthGoals,
  normalizeMonthlyGoals,
} from '../../domain/monthlyGoals.js';

describe('monthlyGoals', () => {
  it('starts tracking months from AGO and allows prep before august', () => {
    expect(goalTrackingMonthKeys(new Date('2026-07-15T12:00:00'), 2026)).toEqual(['AGO']);
    expect(goalTrackingMonthKeys(new Date('2026-08-20T12:00:00'), 2026)).toEqual(['AGO']);
    expect(goalTrackingMonthKeys(new Date('2026-10-05T12:00:00'), 2026)).toEqual(['AGO', 'SEP', 'OCT']);
  });

  it('computes partial progress for measurable commitments', () => {
    expect(computeProgress(4, 8)).toBe(50);
    expect(computeProgress(8, 8)).toBe(100);
    expect(computeProgress(10, 8)).toBe(100);
    expect(computeProgress(0, 8)).toBe(0);
  });

  it('averages certificate and commitment progress for the month', () => {
    const record = normalizeAgentMonthGoals({
      certGoal: 100,
      commitments: [
        { label: 'Gym', target: 8, actual: 4 },
        { label: '', target: null, actual: null },
        { label: '', target: null, actual: null },
      ],
    });
    expect(computeMonthCompletion(record, 50)).toBe(50);
  });

  it('builds measurable items including certificates', () => {
    const record = normalizeAgentMonthGoals({
      certGoal: 100,
      commitments: [{ label: 'Gym', target: 8, actual: 2 }],
    });
    const items = buildMeasurableItems(record, 97);
    expect(items).toHaveLength(2);
    expect(items[0].progress).toBe(97);
    expect(items[1].progress).toBe(25);
  });

  it('computes annual completion average across active months', () => {
    const monthlyGoals = normalizeMonthlyGoals({
      year: 2026,
      byYear: {
        2026: {
          AGO: {
            abel: {
              certGoal: 100,
              commitments: [{ label: 'Gym', target: 8, actual: 8 }],
              opportunities: ['', '', ''],
            },
          },
          SEP: {
            abel: {
              certGoal: 100,
              commitments: [{ label: 'Gym', target: 8, actual: 4 }],
              opportunities: ['', '', ''],
            },
          },
        },
      },
    });
    const summary = computeAnnualGoalSummary(
      monthlyGoals,
      2026,
      'abel',
      ['AGO', 'SEP'],
      { AGO: 100, SEP: 50 },
    );
    expect(summary.average).toBe(75);
    expect(getAgentMonthGoals(monthlyGoals, 2026, 'AGO', 'abel').certGoal).toBe(100);
  });
});
