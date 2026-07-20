import { DAYS, slug } from '../domain/constants.js';
import { emptyWeekDays } from '../domain/schedule.js';

function agent(name, category, opts = {}) {
  return {
    id: slug(name),
    name,
    category,
    collaboratorNumber: opts.collaboratorNumber || '',
    active: true,
    morningWbdEligible: Boolean(opts.morningWbdEligible),
    eveningWbdEligible: opts.eveningWbdEligible !== false && !['SUP', 'GTE'].includes(category)
      ? true
      : Boolean(opts.eveningWbdEligible),
    rules: {
      priorityArea: opts.priorityArea || 'BALANCE',
      maxSalaPerWeek: opts.maxSalaPerWeek ?? null,
      maxLobbyPerWeek: opts.maxLobbyPerWeek ?? null,
      lobbyWeekdaysOnly9AM: Boolean(opts.lobbyWeekdaysOnly9AM),
      noOpening7Weekdays: Boolean(opts.noOpening7Weekdays),
      noLobbyCloseWeekdays: Boolean(opts.noLobbyCloseWeekdays),
      fixedOffDays: opts.fixedOffDays || [],
      fixedPossibleOffDays: opts.fixedPossibleOffDays || [],
      cannotShareAreaWith: (opts.cannotShareAreaWith || []).map((n) => slug(n)),
      brazilMarket: Boolean(opts.brazilMarket),
      brazilPairId: opts.brazilPairId ? slug(opts.brazilPairId) : null,
    },
    updatedAt: new Date().toISOString(),
  };
}

export const SEED_AGENTS = [
  agent('Lolo', 'TOP', { morningWbdEligible: true }),
  agent('Julian', 'TOP', { morningWbdEligible: false }),
  agent('Felix', 'TOP', { morningWbdEligible: true }),
  agent('Nelson', 'TOP', { morningWbdEligible: true }),
  agent('Sebas', 'TOP', { morningWbdEligible: true, noOpening7Weekdays: true }),
  agent('Yohelvi', 'TOP', { morningWbdEligible: false }),
  agent('Sammy', 'TOP', { morningWbdEligible: true }),
  agent('Yaque', 'TOP', { morningWbdEligible: false, priorityArea: 'LOBBY', maxSalaPerWeek: 1 }),
  agent('Renata', 'MA', {
    morningWbdEligible: false,
    priorityArea: 'SALA',
    maxLobbyPerWeek: 1,
    brazilMarket: true,
    brazilPairId: 'Camila',
  }),
  agent('Lau', 'MA', {
    morningWbdEligible: true,
    maxSalaPerWeek: 2,
    lobbyWeekdaysOnly9AM: true,
    noOpening7Weekdays: true,
    noLobbyCloseWeekdays: true,
  }),
  agent('Sam', 'MA', { morningWbdEligible: false }),
  agent('Mich', 'MA', {
    morningWbdEligible: true,
    lobbyWeekdaysOnly9AM: true,
    noOpening7Weekdays: true,
    noLobbyCloseWeekdays: true,
  }),
  agent('Camila', 'MA', {
    morningWbdEligible: false,
    priorityArea: 'SALA',
    maxLobbyPerWeek: 1,
    brazilMarket: true,
    brazilPairId: 'Renata',
  }),
  agent('Abel', 'MA', { morningWbdEligible: false, eveningWbdEligible: true }),
  agent('Luny', 'MB', { morningWbdEligible: false, priorityArea: 'LOBBY', maxSalaPerWeek: 1 }),
  agent('Rai', 'MB', { morningWbdEligible: true, maxSalaPerWeek: 2 }),
  agent('Isaac', 'MB', { morningWbdEligible: false, priorityArea: 'SALA', maxLobbyPerWeek: 1 }),
  agent('JC', 'MB', { morningWbdEligible: false }),
  agent('Arturo', 'MB', { morningWbdEligible: false }),
  agent('Persis', 'SUP', {
    morningWbdEligible: false,
    eveningWbdEligible: false,
    priorityArea: 'LOBBY',
    cannotShareAreaWith: ['Berno'],
  }),
  agent('Berno', 'SUP', {
    morningWbdEligible: false,
    eveningWbdEligible: false,
    priorityArea: 'SALA',
    cannotShareAreaWith: ['Persis'],
  }),
  agent('Rei', 'GTE', {
    morningWbdEligible: false,
    eveningWbdEligible: false,
    priorityArea: 'SALA',
    cannotShareAreaWith: ['Cris'],
    fixedOffDays: ['Sabado'],
    fixedPossibleOffDays: ['Viernes'],
    maxLobbyPerWeek: 1,
    lobbyWeekdaysOnly9AM: true,
  }),
  agent('Cris', 'GTE', {
    morningWbdEligible: false,
    eveningWbdEligible: false,
    priorityArea: 'LOBBY',
    cannotShareAreaWith: ['Rei'],
    fixedOffDays: ['Sabado'],
    fixedPossibleOffDays: ['Viernes'],
    maxSalaPerWeek: 1,
  }),
];

export const SEED_FORECAST_SETTINGS = {
  qualificationPercent: 0.6,
  shotsPerAgent: 15,
};

export function buildEmptyForecastRows(mondayIso = '') {
  return DAYS.map((day, index) => ({
    day,
    date: mondayIso ? addDays(mondayIso, index) : '',
    total: '',
    lobby: '',
    level: 'Medio',
    note: '',
  }));
}

export function buildDemoScheduleDays() {
  const days = emptyWeekDays();
  days.Lunes['9AM'] = ['lolo', 'felix', 'lau'];
  days.Lunes['8:50AM'] = ['renata', 'camila', 'sam', 'abel', 'mich', 'jc'];
  days.Lunes['7:00AM'] = ['nelson', 'sammy'];
  days.Martes['8:50AM'] = ['luny', 'rai', 'isaac', 'arturo', 'julian', 'yohelvi'];
  days.Martes['9AM'] = ['mich', 'abel', 'sam'];
  return days;
}

function addDays(iso, offset) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export const SEED_DATA = {
  agents: SEED_AGENTS,
  schedules: {
    current: { weekKey: 'current', mondayIso: '', days: buildDemoScheduleDays(), updatedAt: new Date().toISOString() },
    next: { weekKey: 'next', mondayIso: '', days: emptyWeekDays(), updatedAt: new Date().toISOString() },
  },
  forecasts: {
    current: buildEmptyForecastRows(),
    next: buildEmptyForecastRows(),
  },
  forecastSettings: SEED_FORECAST_SETTINGS,
  morningWbdMap: Object.fromEntries(DAYS.map((day) => [day, []])),
  eveningWbdCounts: Object.fromEntries(SEED_AGENTS.map((a) => [a.id, 0])),
  visibleWeek: 'current',
  forecastEditWeek: 'current',
  requests: [],
  exceptions: [],
};

export function seedAgentById(id) {
  return SEED_AGENTS.find((agent) => agent.id === id) || null;
}
