import { describe, expect, it } from 'vitest';
import { WBD_EVENING_BLOCK, OPENING_LOBBY_BLOCK } from '../../domain/blocks.js';
import { canAssign } from '../../domain/rules/canAssign.js';
import { emptyWeekDays } from '../../domain/schedule.js';
import { parseAgent } from '../../domain/schemas.js';
import { SEED_AGENTS, seedAgentById } from '../../js/seed-data.js';

function agent(id) {
  const seed = seedAgentById(id);
  if (!seed) throw new Error(`missing seed ${id}`);
  return parseAgent(seed).value;
}

function scheduleWith(day, block, agentId) {
  const days = emptyWeekDays();
  days[day][block] = [agentId];
  return { weekKey: 'current', mondayIso: '', days, updatedAt: '' };
}

function ctx(day, schedule, extra = {}) {
  const agentsById = Object.fromEntries(SEED_AGENTS.map((a) => [a.id, parseAgent(a).value]));
  return {
    schedule,
    agentsById,
    capacity: {
      '8:50AM': 6,
      'Cierre Sala': 1,
      [OPENING_LOBBY_BLOCK]: 2,
      '8AM': 5,
      '9AM': 3,
      'Cierre Lobby': 1,
      [WBD_EVENING_BLOCK]: 1,
      'Posible Off': 5,
      Off: 5,
    },
    day,
    isWeekday: (d) => ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].includes(d),
    previousDay: (d) => ({
      Lunes: 'Domingo', Martes: 'Lunes', Miercoles: 'Martes', Jueves: 'Miercoles',
      Viernes: 'Jueves', Sabado: 'Viernes', Domingo: 'Sabado',
    }[d]),
    countSalaWeek: () => 0,
    countLobbyWeek: () => 0,
    morningWbdMap: Object.fromEntries(['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'].map((d) => [d, []])),
    ...extra,
  };
}

describe('canAssign', () => {
  it('rejects SUP opening 7:00AM', () => {
    const rei = agent('rei');
    const result = canAssign(rei, OPENING_LOBBY_BLOCK, 'Lunes', ctx('Lunes', emptyWeekDays()));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SUP_GTE_NO_OPEN_CLOSE');
  });

  it('rejects Lau in 8AM on weekday (lobby 9AM only)', () => {
    const lau = agent('lau');
    const result = canAssign(lau, '8AM', 'Lunes', ctx('Lunes', emptyWeekDays()));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('LOBBY_WEEKDAY_9_ONLY');
  });

  it('allows Lau in 9AM on weekday', () => {
    const lau = agent('lau');
    const result = canAssign(lau, '9AM', 'Lunes', ctx('Lunes', emptyWeekDays()));
    expect(result.ok).toBe(true);
  });

  it('rejects Sebas opening 7:00AM weekday', () => {
    const sebas = agent('sebas');
    const result = canAssign(sebas, OPENING_LOBBY_BLOCK, 'Martes', ctx('Martes', emptyWeekDays()));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NO_OPEN_7');
  });

  it('rejects non eligible evening WBD', () => {
    const rei = agent('rei');
    const result = canAssign(rei, WBD_EVENING_BLOCK, 'Lunes', ctx('Lunes', emptyWeekDays()));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_EVENING_WBD_ELIGIBLE');
  });

  it('allows eligible evening WBD', () => {
    const abel = agent('abel');
    const result = canAssign(abel, WBD_EVENING_BLOCK, 'Lunes', ctx('Lunes', emptyWeekDays()));
    expect(result.ok).toBe(true);
  });

  it('blocks open after evening WBD previous day', () => {
    const abel = agent('abel');
    const days = emptyWeekDays();
    days.Domingo[WBD_EVENING_BLOCK] = ['abel'];
    const result = canAssign(abel, OPENING_LOBBY_BLOCK, 'Lunes', ctx('Lunes', { weekKey: 'current', days, updatedAt: '' }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('EVENING_WBD_NEXT_DAY');
  });

  it('rejects Rei and Cris sharing lobby', () => {
    const cris = agent('cris');
    const schedule = scheduleWith('Lunes', '9AM', 'rei');
    const result = canAssign(cris, '8AM', 'Lunes', ctx('Lunes', schedule));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('FORBIDDEN_PAIR');
  });

  it('rejects duplicate same day', () => {
    const lolo = agent('lolo');
    const schedule = scheduleWith('Lunes', '9AM', 'lolo');
    const result = canAssign(lolo, '8AM', 'Lunes', ctx('Lunes', schedule));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('DUPLICATE_DAY');
  });

  it('rejects morning WBD when not eligible', () => {
    const julian = agent('julian');
    const result = canAssign(julian, '9AM', 'Lunes', ctx('Lunes', emptyWeekDays(), {
      morningWbdCheck: true,
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_MORNING_WBD_ELIGIBLE');
  });

  it('rejects 4th morning WBD', () => {
    const lolo = agent('lolo');
    const days = emptyWeekDays();
    days.Lunes['9AM'] = ['lolo'];
    const wbdMap = { Lunes: ['felix', 'nelson', 'sammy'] };
    const result = canAssign(lolo, '9AM', 'Lunes', ctx('Lunes', { weekKey: 'current', days, updatedAt: '' }, {
      morningWbdCheck: true,
      morningWbdMap: wbdMap,
      allowSameAgent: true,
    }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('MORNING_WBD_LIMIT');
  });

  it('allows morning WBD toggle when 9AM is full but agent is in lobby mañana', () => {
    const lolo = agent('lolo');
    const days = emptyWeekDays();
    days.Lunes['9AM'] = ['felix', 'nelson', 'sammy'];
    days.Lunes[OPENING_LOBBY_BLOCK] = ['lolo'];
    const result = canAssign(lolo, '9AM', 'Lunes', ctx('Lunes', { weekKey: 'current', days, updatedAt: '' }, {
      morningWbdCheck: true,
      morningWbdMap: { Lunes: [] },
      allowSameAgent: true,
    }));
    expect(result.ok).toBe(true);
  });
});

describe('schemas', () => {
  it('parses all seed agents', () => {
    for (const raw of SEED_AGENTS) {
      const parsed = parseAgent(raw);
      expect(parsed.ok, parsed.errors?.join(', ')).toBe(true);
    }
  });
});
