import { blockArea } from './blocks.js';

export const SCHEDULE_LEARNING_VERSION = 1;
export const MAX_SCHEDULE_LEARNING_EVENTS = 400;

export function emptyScheduleLearningStore() {
  return { version: SCHEDULE_LEARNING_VERSION, events: [] };
}

export function normalizeScheduleLearningStore(raw) {
  if (!raw || !Array.isArray(raw.events)) return emptyScheduleLearningStore();
  const events = raw.events
    .filter((event) => event?.agentId && event?.day && event?.toBlock)
    .map((event) => ({
      weekKey: String(event.weekKey || 'current'),
      agentId: String(event.agentId),
      day: String(event.day),
      fromBlock: String(event.fromBlock || ''),
      toBlock: String(event.toBlock),
      toArea: String(event.toArea || blockArea(event.toBlock)),
      fromArea: String(event.fromArea || blockArea(event.fromBlock)),
      category: String(event.category || ''),
      at: Number(event.at) || Date.now(),
    }))
    .slice(0, MAX_SCHEDULE_LEARNING_EVENTS);
  return { version: SCHEDULE_LEARNING_VERSION, events };
}

export function appendScheduleLearningEvent(store, event) {
  const normalized = normalizeScheduleLearningStore(store);
  if (!event?.agentId || !event?.day || !event?.toBlock) return normalized;
  const nextEvent = {
    weekKey: String(event.weekKey || 'current'),
    agentId: String(event.agentId),
    day: String(event.day),
    fromBlock: String(event.fromBlock || ''),
    toBlock: String(event.toBlock),
    toArea: blockArea(event.toBlock),
    fromArea: blockArea(event.fromBlock),
    category: String(event.category || ''),
    at: Number(event.at) || Date.now(),
  };
  if (nextEvent.fromBlock === nextEvent.toBlock) return normalized;
  return normalizeScheduleLearningStore({
    version: SCHEDULE_LEARNING_VERSION,
    events: [nextEvent, ...normalized.events],
  });
}

export function buildLearningProfile(events = []) {
  const byAgent = {};
  const now = Date.now();
  events.forEach((event, index) => {
    const ageDays = (now - (event.at || now)) / 86400000;
    const weight = Math.max(0.35, 1 - ageDays * 0.04) * (1 - index * 0.0015);
    const bucket = byAgent[event.agentId] || {
      sala: 0,
      lobby: 0,
      off: 0,
      posible: 0,
      blocks: {},
      days: {},
    };
    if (event.toArea === 'SALA') bucket.sala += weight;
    if (event.toArea === 'LOBBY') bucket.lobby += weight;
    if (event.toArea === 'OFF') bucket.off += weight;
    if (event.toArea === 'POSSIBLE') bucket.posible += weight;
    if (event.toBlock) bucket.blocks[event.toBlock] = (bucket.blocks[event.toBlock] || 0) + weight;
    if (event.day) bucket.days[event.day] = (bucket.days[event.day] || 0) + weight;
    byAgent[event.agentId] = bucket;
  });
  return { byAgent, eventCount: events.length };
}

export function getLearningScoreBoost(agentId, block, day, profile) {
  const bucket = profile?.byAgent?.[agentId];
  if (!bucket) return 0;
  const area = blockArea(block);
  let boost = 0;
  if (area === 'SALA') boost += bucket.sala * 4;
  if (area === 'LOBBY') boost += bucket.lobby * 4;
  if (area === 'OFF') boost += bucket.off * 3;
  if (area === 'POSSIBLE') boost += bucket.posible * 3;
  boost += (bucket.blocks[block] || 0) * 6;
  boost += (bucket.days[day] || 0) * 2;
  return Math.min(45, boost);
}

export function learningSummary(profile) {
  const count = profile?.eventCount || 0;
  const agents = Object.keys(profile?.byAgent || {}).length;
  if (!count) return '';
  return `${count} ajuste${count === 1 ? '' : 's'} manual${count === 1 ? '' : 'es'} de ${agents} agente${agents === 1 ? '' : 's'} influyen en esta generación.`;
}
