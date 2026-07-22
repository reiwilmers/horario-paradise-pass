import { describe, expect, it } from 'vitest';
import { DAYS } from '../../domain/constants.js';
import {
  ALERT_KIND,
  alertsToMessages,
  collectScheduleAlerts,
  collectUnassignedAlerts,
  unassignedAgentsByDay,
  unassignedCount,
} from '../../domain/scheduleAlerts.js';

describe('scheduleAlerts domain', () => {
  const agents = [
    { id: 'sebas', name: 'Sebas', category: 'TOP', active: true },
    { id: 'abel', name: 'Abel', category: 'MA', active: true },
  ];

  const empty = {
    '8:50AM': [], '7:00AM': [], '8AM': [], '9AM': [], 'Cierre Lobby': [], 'Cierre Sala': [],
    'WBD 5:30PM': [], 'Posible Off': [], Off: [],
  };

  it('collectUnassignedAlerts ignores agents already in any block', () => {
    const days = Object.fromEntries(DAYS.map((day) => {
      if (day === 'Lunes') return [day, { ...empty, '9AM': ['sebas', 'abel'] }];
      return [day, { ...empty, '9AM': ['abel'] }];
    }));

    const alerts = collectUnassignedAlerts({
      days,
      agents,
      forecast: DAYS.map((day, index) => ({ date: `2026-07-${21 + index}` })),
      exceptions: [],
    });

    expect(alerts.every((alert) => alert.kind === ALERT_KIND.UNASSIGNED)).toBe(true);
    expect(alerts.some((alert) => alert.agentId === 'sebas' && alert.day === 'Lunes')).toBe(false);
    expect(alerts.some((alert) => alert.agentId === 'sebas' && alert.day === 'Martes')).toBe(true);
  });

  it('flags agents missing from a day', () => {
    const days = Object.fromEntries(DAYS.map((day) => {
      if (day === 'Lunes') return [day, { ...empty, '9AM': ['abel'] }];
      if (day === 'Martes') return [day, { ...empty, '9AM': ['abel'] }];
      return [day, { ...empty, '9AM': ['abel'] }];
    }));

    const alerts = collectScheduleAlerts({
      days,
      agents,
      forecast: DAYS.map((day, index) => ({ date: `2026-07-${21 + index}` })),
      exceptions: [],
      morningWbdMap: Object.fromEntries(DAYS.map((day) => [day, ['a', 'b', 'c']])),
    });

    const unassigned = alerts.filter((alert) => alert.kind === ALERT_KIND.UNASSIGNED);
    expect(unassigned.some((alert) => alert.agentId === 'sebas' && alert.day === 'Lunes')).toBe(true);
    expect(unassigned.some((alert) => alert.agentId === 'sebas' && alert.day === 'Martes')).toBe(true);
    expect(unassignedCount(alerts)).toBeGreaterThanOrEqual(2);
  });

  it('skips unassigned alerts for agents on vacation', () => {
    const days = Object.fromEntries(DAYS.map((day) => [day, { ...empty }]));
    const alerts = collectScheduleAlerts({
      days,
      agents,
      forecast: [{ date: '2026-07-21' }, ...DAYS.slice(1).map(() => ({}))],
      exceptions: [{
        type: 'VACACIONES',
        agentId: 'sebas',
        from: '2026-07-21',
        until: '2026-07-21',
        active: true,
      }],
      morningWbdMap: Object.fromEntries(DAYS.map((day) => [day, ['a', 'b', 'c']])),
    });

    expect(alerts.some((alert) => alert.agentId === 'sebas' && alert.day === 'Lunes' && alert.kind === ALERT_KIND.UNASSIGNED)).toBe(false);
  });

  it('groups unassigned agents by day', () => {
    const alerts = [
      { kind: ALERT_KIND.UNASSIGNED, day: 'Lunes', agentName: 'Sebas', message: '' },
      { kind: ALERT_KIND.UNASSIGNED, day: 'Lunes', agentName: 'Abel', message: '' },
      { kind: ALERT_KIND.WBD_SHORT, day: 'Martes', message: 'WBD' },
    ];
    expect(unassignedAgentsByDay(alerts)).toEqual({ Lunes: ['Abel', 'Sebas'] });
  });

  it('maps alerts to legacy message strings', () => {
    const alerts = collectScheduleAlerts({
      days: { Lunes: { ...empty } },
      agents: [{ id: 'sebas', name: 'Sebas', category: 'TOP', active: true }],
      forecast: [{ date: '2026-07-21' }],
      exceptions: [],
      morningWbdMap: { Lunes: [] },
    });
    const messages = alertsToMessages(alerts);
    expect(messages.some((message) => message.includes('Sebas') && message.includes('No aparece en el día'))).toBe(true);
    expect(messages.some((message) => message.includes('Faltan WBD mañana'))).toBe(true);
  });
});
