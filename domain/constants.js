/** @typedef {'TOP'|'MA'|'MB'|'SUP'|'GTE'} AgentCategory */
/** @typedef {'BALANCE'|'SALA'|'LOBBY'} PriorityArea */
/** @typedef {'current'|'next'} WeekKey */

export const DAYS = [
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
  'Domingo',
];

export const CATEGORIES = ['TOP', 'MA', 'MB', 'SUP', 'GTE'];
export const ADMIN_CATEGORIES = new Set(['SUP', 'GTE']);
export const SELLER_CATEGORIES = new Set(['TOP', 'MA', 'MB']);
export const PRIORITY_AREAS = ['BALANCE', 'SALA', 'LOBBY'];

export const GENERAL_SALA_DAYS = new Set(['Martes', 'Jueves', 'Sabado']);
export const GENERAL_LOBBY_DAYS = new Set(['Lunes', 'Miercoles', 'Viernes', 'Domingo']);

export const REQUEST_TYPES = [
  'Off solicitado',
  'Posible off',
  'Vacaciones',
  'Cambio de horario con otro agente',
];

export const DEFAULT_FORECAST_SETTINGS = {
  qualificationPercent: 0.6,
  shotsPerAgent: 15,
};

export const MORNING_WBD_LIMIT = 3;

export function slug(name = '') {
  return String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

export function isWeekday(day) {
  const index = DAYS.indexOf(day);
  return index >= 0 && index <= 4;
}

export function previousDay(day) {
  const index = DAYS.indexOf(day);
  return DAYS[(index + DAYS.length - 1) % DAYS.length];
}

export function displayNameFromId(id = '') {
  return String(id)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
