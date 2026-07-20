import { CATEGORIES, DAYS, PRIORITY_AREAS, slug } from './constants.js';
import { ASSIGNABLE_BLOCKS, BLOCK_KEYS, CAPACITY } from './blocks.js';

export function defaultAgentRules() {
  return {
    priorityArea: 'BALANCE',
    maxSalaPerWeek: null,
    maxLobbyPerWeek: null,
    lobbyWeekdaysOnly9AM: false,
    noOpening7Weekdays: false,
    noLobbyCloseWeekdays: false,
    fixedOffDays: [],
    fixedPossibleOffDays: [],
    cannotShareAreaWith: [],
    brazilMarket: false,
    brazilPairId: null,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function parseAgentRules(raw) {
  const base = defaultAgentRules();
  if (!raw || typeof raw !== 'object') return { ok: true, value: base };
  const rules = { ...base, ...raw };
  const errors = [];
  if (!PRIORITY_AREAS.includes(rules.priorityArea)) errors.push('priorityArea invalid');
  if (rules.maxSalaPerWeek != null && typeof rules.maxSalaPerWeek !== 'number') errors.push('maxSalaPerWeek invalid');
  if (rules.maxLobbyPerWeek != null && typeof rules.maxLobbyPerWeek !== 'number') errors.push('maxLobbyPerWeek invalid');
  if (!Array.isArray(rules.fixedOffDays)) errors.push('fixedOffDays invalid');
  if (!Array.isArray(rules.fixedPossibleOffDays)) errors.push('fixedPossibleOffDays invalid');
  if (!Array.isArray(rules.cannotShareAreaWith)) errors.push('cannotShareAreaWith invalid');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: rules };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function parseAgent(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['agent required'] };
  const name = String(raw.name || '').trim();
  const id = String(raw.id || slug(name)).trim();
  if (!id) errors.push('id required');
  if (!name) errors.push('name required');
  const category = String(raw.category || 'MA');
  if (!CATEGORIES.includes(category)) errors.push('category invalid');
  const rulesResult = parseAgentRules(raw.rules);
  if (!rulesResult.ok) errors.push(...rulesResult.errors);
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      name,
      category,
      collaboratorNumber: String(raw.collaboratorNumber ?? raw.numeroColaborador ?? '').trim(),
      active: raw.active !== false,
      morningWbdEligible: Boolean(raw.morningWbdEligible),
      eveningWbdEligible: raw.eveningWbdEligible !== false,
      rules: rulesResult.value,
      updatedAt: raw.updatedAt || new Date().toISOString(),
    },
  };
}

/**
 * @param {Record<string, string[]>} dayPlan
 */
export function parseDayPlan(dayPlan = {}) {
  const normalized = {};
  for (const block of ASSIGNABLE_BLOCKS) {
    const agents = Array.isArray(dayPlan[block]) ? dayPlan[block] : [];
    normalized[block] = [...new Set(agents.filter(Boolean).map(String))];
  }
  return normalized;
}

/**
 * @param {unknown} raw
 * @param {Set<string>} validAgentIds
 */
export function parseScheduleWeek(raw, validAgentIds = new Set()) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['schedule required'] };
  const days = {};
  for (const day of DAYS) {
    const dayPlan = parseDayPlan(raw[day] || raw.days?.[day]);
    const seen = new Set();
    for (const block of ASSIGNABLE_BLOCKS) {
      const list = dayPlan[block] || [];
      if (list.length > CAPACITY[block]) errors.push(`${day} ${block} over capacity`);
      for (const agentId of list) {
        if (validAgentIds.size && !validAgentIds.has(agentId)) errors.push(`${day} unknown agent ${agentId}`);
        if (seen.has(agentId)) errors.push(`${day} duplicate ${agentId}`);
        seen.add(agentId);
      }
    }
    days[day] = dayPlan;
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      weekKey: raw.weekKey === 'next' ? 'next' : 'current',
      mondayIso: String(raw.mondayIso || ''),
      days,
      updatedAt: raw.updatedAt || new Date().toISOString(),
    },
  };
}

/** @param {string[]} ids @param {number} limit */
export function parseMorningWbdDay(ids, limit = 3) {
  if (!Array.isArray(ids)) return { ok: false, errors: ['wbd ids must be array'] };
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length > limit) return { ok: false, errors: [`max ${limit} morning WBD`] };
  return { ok: true, value: unique };
}

/** @param {Record<string, string[]>} wbdMap */
export function parseMorningWbdMap(wbdMap = {}) {
  const next = {};
  const errors = [];
  for (const day of DAYS) {
    const parsed = parseMorningWbdDay(wbdMap[day]);
    if (!parsed.ok) errors.push(...parsed.errors.map((e) => `${day}: ${e}`));
    else next[day] = parsed.value;
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: next };
}

export function validateBlockKey(blockKey) {
  return BLOCK_KEYS.includes(blockKey);
}
