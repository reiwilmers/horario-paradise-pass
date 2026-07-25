import { describe, expect, it } from 'vitest';
import { emptyWeekDays } from '../../domain/schedule.js';
import {
  agentsAvailableForDay,
  buildDashboardEditAlerts,
} from '../../js/views/dashboard-alerts-panel.js';

describe('dashboard edit helpers', () => {
  const agents = [
    { id: 'abel', name: 'Abel', active: true },
    { id: 'nelson', name: 'Nelson', active: true },
    { id: 'persis', name: 'Persis', active: true },
  ];

  it('lists only agents without role that day', () => {
    const schedule = { days: emptyWeekDays() };
    schedule.days.Lunes['9AM'] = ['abel'];
    const available = agentsAvailableForDay('Lunes', {
      schedule,
      forecast: [{ day: 'Lunes', date: '2026-07-21' }],
      exceptions: [],
      agents,
    });
    expect(available.map((agent) => agent.id)).toEqual(['nelson', 'persis']);
  });

  it('excludes vacation agents from available list', () => {
    const schedule = { days: emptyWeekDays() };
    const available = agentsAvailableForDay('Lunes', {
      schedule,
      forecast: [{ day: 'Lunes', date: '2026-07-21' }],
      exceptions: [{
        agentId: 'nelson',
        type: 'VACACIONES',
        from: '2026-07-21',
        until: '2026-07-26',
        active: true,
      }],
      agents,
    });
    expect(available.map((agent) => agent.id)).toEqual(['abel', 'persis']);
  });

  it('builds edit alerts for visible week', () => {
    const schedule = { days: emptyWeekDays() };
    schedule.days.Lunes['9AM'] = ['abel'];
    const alerts = buildDashboardEditAlerts({
      visibleWeek: 'current',
      schedules: { current: schedule },
      forecasts: { current: [{ day: 'Lunes', date: '2026-07-21' }] },
      exceptions: [],
      agents: { ids: agents.map((agent) => agent.id), byId: Object.fromEntries(agents.map((a) => [a.id, a])) },
    }, 'current');
    expect(alerts.some((alert) => alert.agentName === 'Nelson' && alert.day === 'Lunes')).toBe(true);
  });
});
