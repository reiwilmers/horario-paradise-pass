import { describe, expect, it } from 'vitest';
import { DAYS } from '../../domain/constants.js';
import {
  SCHEDULE_WORKFLOW,
  collectUnassignedGroupsForPhase,
  collectWorkflowReminders,
  isNextForecastComplete,
  scheduleWorkflowPhase,
} from '../../domain/scheduleWorkflow.js';
import { buildTodayReview } from '../../domain/todayReview.js';

describe('scheduleWorkflow domain', () => {
  const empty = {
    '8:50AM': [], '7:00AM': [], '8AM': [], '9AM': [], 'Cierre Lobby': [], 'Cierre Sala': [],
    'WBD 5:30PM': [], 'Posible Off': [], Off: [],
  };

  const agents = [
    { id: 'sebas', name: 'Sebas', category: 'TOP', active: true },
    { id: 'abel', name: 'Abel', category: 'MA', active: true },
  ];

  it('maps weekdays to workflow phases', () => {
    expect(scheduleWorkflowPhase(new Date('2026-07-20T12:00:00'))).toBe(SCHEDULE_WORKFLOW.QUIET);
    expect(scheduleWorkflowPhase(new Date('2026-07-21T12:00:00'))).toBe(SCHEDULE_WORKFLOW.QUIET);
    expect(scheduleWorkflowPhase(new Date('2026-07-23T12:00:00'))).toBe(SCHEDULE_WORKFLOW.FORECAST);
    expect(scheduleWorkflowPhase(new Date('2026-07-24T12:00:00'))).toBe(SCHEDULE_WORKFLOW.BUILD);
    expect(scheduleWorkflowPhase(new Date('2026-07-25T12:00:00'))).toBe(SCHEDULE_WORKFLOW.VERIFY);
    expect(scheduleWorkflowPhase(new Date('2026-07-26T12:00:00'))).toBe(SCHEDULE_WORKFLOW.VERIFY);
  });

  it('requires totals in every next-week forecast row', () => {
    expect(isNextForecastComplete(DAYS.map(() => ({ total: 100 })))).toBe(true);
    expect(isNextForecastComplete(DAYS.map((_, index) => ({ total: index === 0 ? '' : 50 })))).toBe(false);
  });

  it('shows forecast reminder on thursday and hides unassigned until weekend', () => {
    const thursday = new Date('2026-07-23T12:00:00');
    const reminders = collectWorkflowReminders(
      SCHEDULE_WORKFLOW.FORECAST,
      { current: { days: {} }, next: { days: {} } },
      { next: DAYS.map(() => ({ total: '' })) },
      agents,
      [],
      thursday,
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0].navPage).toBe('forecast');
    expect(reminders[0].urgent).toBe(true);

    const unassigned = collectUnassignedGroupsForPhase(
      SCHEDULE_WORKFLOW.FORECAST,
      { next: { days: Object.fromEntries(DAYS.map((day) => [day, empty])) } },
      { next: DAYS.map((_, index) => ({ date: `2026-07-${27 + index}` })) },
      agents,
      [],
      thursday,
    );
    expect(unassigned).toEqual([]);
  });

  it('shows only next-week unassigned groups on saturday', () => {
    const saturday = new Date('2026-07-25T12:00:00');
    const nextDays = Object.fromEntries(DAYS.map((day) => [day, { ...empty, '9AM': ['abel'] }]));
    const groups = collectUnassignedGroupsForPhase(
      SCHEDULE_WORKFLOW.VERIFY,
      { current: { days: nextDays }, next: { days: nextDays } },
      { next: DAYS.map((_, index) => ({ date: `2026-07-${27 + index}` })) },
      agents,
      [],
      saturday,
    );
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.weekKey === 'next')).toBe(true);
    expect(groups.some((group) => group.agents.includes('Sebas'))).toBe(true);
  });

  it('buildTodayReview hides unassigned counts monday through wednesday', () => {
    const scheduleDays = Object.fromEntries(DAYS.map((day) => [day, { ...empty, '9AM': ['abel'] }]));
    const review = buildTodayReview({
      agents: { ids: ['sebas', 'abel'], byId: Object.fromEntries(agents.map((a) => [a.id, a])) },
      requests: [],
      schedules: { current: { days: scheduleDays }, next: { days: scheduleDays } },
      forecasts: { current: [], next: [] },
      exceptions: [],
      monthlyGoals: { year: 2026, byYear: { 2026: { AGO: {} } } },
    }, new Date('2026-07-21T12:00:00'));

    expect(review.workflowPhase).toBe(SCHEDULE_WORKFLOW.QUIET);
    expect(review.unassigned).toEqual([]);
    expect(review.summary.unassignedAgents).toBe(0);
    expect(review.scheduleMeta.quietNote).toMatch(/sábado/i);
  });
});
