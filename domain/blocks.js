import { GENERAL_LOBBY_DAYS, GENERAL_SALA_DAYS } from './constants.js';

/** @typedef {{ key: string, label: string, capacity: number, area: 'SALA'|'LOBBY'|'OFF'|'POSSIBLE', tone: string, section?: string, visualTime?: string }} BlockDef */

/** @type {Record<string, BlockDef>} */
export const BLOCKS = {
  SALA_850: {
    key: '8:50AM',
    label: '8:50AM',
    capacity: 6,
    area: 'SALA',
    tone: 'sala',
    section: 'SALA',
  },
  CIERRE_SALA: {
    key: 'Cierre Sala',
    label: 'Cierre Sala',
    capacity: 1,
    area: 'SALA',
    tone: 'cierreSala',
  },
  OPEN_700: {
    key: '7:00AM',
    label: '7:00AM',
    capacity: 2,
    area: 'LOBBY',
    tone: 'seven',
    section: 'LOBBY',
  },
  LOBBY_800: {
    key: '8AM',
    label: '8AM',
    capacity: 5,
    area: 'LOBBY',
    tone: 'eight',
  },
  LOBBY_900: {
    key: '9AM',
    label: '9AM',
    capacity: 3,
    area: 'LOBBY',
    tone: 'nine',
  },
  CIERRE_LOBBY: {
    key: 'Cierre Lobby',
    label: 'Cierre Lobby',
    capacity: 1,
    area: 'LOBBY',
    tone: 'cierreLobby',
    visualTime: '10AM',
  },
  WBD_530: {
    key: 'WBD 5:30PM',
    label: 'WBD 5:30PM',
    capacity: 1,
    area: 'LOBBY',
    tone: 'wbdEvening',
    section: 'LOBBY',
  },
  POSIBLE_OFF: {
    key: 'Posible Off',
    label: 'Posible Off',
    capacity: 99,
    area: 'POSSIBLE',
    tone: 'posibleOff',
  },
  OFF: {
    key: 'Off',
    label: 'Off',
    capacity: 99,
    area: 'OFF',
    tone: 'off',
  },
};

export const BLOCK_LIST = Object.values(BLOCKS);
export const BLOCK_KEYS = BLOCK_LIST.map((block) => block.key);
export const ASSIGNABLE_BLOCKS = BLOCK_KEYS;
export const CAPACITY = Object.fromEntries(BLOCK_LIST.map((block) => [block.key, block.capacity]));

export const LOBBY_BLOCKS = BLOCK_LIST.filter((block) => block.area === 'LOBBY').map((block) => block.key);
export const SALA_BLOCKS = BLOCK_LIST.filter((block) => block.area === 'SALA').map((block) => block.key);
export const MORNING_WBD_BLOCKS = [BLOCKS.OPEN_700.key, BLOCKS.LOBBY_800.key, BLOCKS.LOBBY_900.key];
export const WBD_EVENING_BLOCK = BLOCKS.WBD_530.key;
export const OPENING_LOBBY_BLOCK = BLOCKS.OPEN_700.key;

/** Blocks restricted after evening WBD previous day */
export const BLOCKS_AFTER_EVENING_WBD = [
  OPENING_LOBBY_BLOCK,
  BLOCKS.CIERRE_LOBBY.key,
  BLOCKS.CIERRE_SALA.key,
];

export const SCHEDULE_ROWS = [
  { type: 'assignment', ...BLOCKS.SALA_850 },
  { type: 'assignment', ...BLOCKS.CIERRE_SALA },
  { type: 'section', key: 'Lobby Header', label: 'LOBBY', tone: 'lobbyHeader' },
  { type: 'assignment', ...BLOCKS.OPEN_700 },
  { type: 'assignment', ...BLOCKS.LOBBY_800 },
  { type: 'assignment', ...BLOCKS.LOBBY_900 },
  { type: 'assignment', ...BLOCKS.CIERRE_LOBBY },
  { type: 'assignment', ...BLOCKS.WBD_530 },
  { type: 'assignment', ...BLOCKS.POSIBLE_OFF },
  { type: 'assignment', ...BLOCKS.OFF },
];

export function blockArea(blockKey) {
  const block = BLOCK_LIST.find((item) => item.key === blockKey);
  return block?.area ?? '';
}

export function isGeneralClose(day, blockKey) {
  return (
    (GENERAL_LOBBY_DAYS.has(day) && blockKey === BLOCKS.CIERRE_LOBBY.key)
    || (GENERAL_SALA_DAYS.has(day) && blockKey === BLOCKS.CIERRE_SALA.key)
  );
}

export function getBlock(blockKey) {
  return BLOCK_LIST.find((block) => block.key === blockKey) ?? null;
}
