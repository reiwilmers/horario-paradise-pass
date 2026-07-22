import { describe, expect, it } from 'vitest';
import { buildTodayReview } from '../../domain/todayReview.js';
import { DAYS } from '../../domain/constants.js';

describe('todayReview domain', () => {
  const agents = [
    { id: 'sebas', name: 'Sebas', category: 'TOP', active: true },
    { id: 'abel', name: 'Abel', category: 'MA', active: true },
    { id: 'rei', name: 'Rei', category: 'GTE', active: true },
  ];

  const empty = {
    '8:50AM': [], '7:00AM': [], '8AM': [], '9AM': [], 'Cierre Lobby': [], 'Cierre Sala': [],
    'WBD 5:30PM': [], 'Posible Off': [], Off: [],
  };

  it('summarizes pending requests, unassigned agents, vacations and goals', () => {
    const reference = new Date('2026-08-15T12:00:00');
    const scheduleDays = Object.fromEntries(DAYS.map((day) => [day, { ...empty, '9AM': ['abel'] }]));
    const review = buildTodayReview({
      agents: { ids: agents.map((agent) => agent.id), byId: Object.fromEntries(agents.map((a) => [a.id, a])) },
      requests: [{
        id: 'r1',
        applicantId: 'sebas',
        type: 'Vacaciones',
        from: '2026-09-01',
        until: '2026-09-10',
        status: 'Pendiente',
      }],
      schedules: {
        current: { days: scheduleDays },
        next: { days: scheduleDays },
      },
      forecasts: {
        current: DAYS.map((day, index) => ({ date: `2026-08-${10 + index}` })),
        next: DAYS.map((day, index) => ({ date: `2026-08-${17 + index}` })),
      },
      exceptions: [{
        id: 'e1',
        agentId: 'abel',
        type: 'VACACIONES',
        from: '2026-08-18',
        until: '2026-08-25',
        active: true,
      }],
      monthlyGoals: {
        year: 2026,
        byYear: {
          2026: {
            AGO: {
              sebas: { certGoal: null, commitments: [{ label: 'Lobby', target: 5, actual: null }], opportunities: ['', '', ''] },
              abel: { certGoal: 10, commitments: [{ label: 'Sala', target: 4, actual: 2 }], opportunities: ['', '', ''] },
            },
          },
        },
      },
    }, reference);

    expect(review.summary.pendingRequests).toBe(1);
    expect(review.summary.unassignedAgents).toBeGreaterThan(0);
    expect(review.summary.upcomingVacations).toBe(1);
    expect(review.summary.goalsIncomplete).toBe(1);
    expect(review.allClear).toBe(false);
    expect(review.pendingRequests[0].agentName).toBe('Sebas');
    expect(review.goalsIncomplete[0].agentName).toBe('Sebas');
  });

  it('reports all clear when nothing is pending', () => {
    const scheduleDays = Object.fromEntries(DAYS.map((day) => [day, {
      ...empty,
      '9AM': ['sebas', 'abel'],
    }]));
    const review = buildTodayReview({
      agents: { ids: ['sebas', 'abel'], byId: Object.fromEntries(agents.filter((a) => a.id !== 'rei').map((a) => [a.id, a])) },
      requests: [],
      schedules: { current: { days: scheduleDays }, next: { days: scheduleDays } },
      forecasts: { current: [], next: [] },
      exceptions: [],
      monthlyGoals: {
        year: 2026,
        byYear: {
          2026: {
            AGO: {
              sebas: { certGoal: 10, commitments: [], opportunities: ['', '', ''] },
              abel: { certGoal: 10, commitments: [], opportunities: ['', '', ''] },
            },
          },
        },
      },
    }, new Date('2026-07-21T12:00:00'));

    expect(review.allClear).toBe(true);
    expect(review.summary.total).toBe(0);
  });
});
