import { MORNING_WBD_LIMIT } from '../constants.js';
import {
  checkAgentActive,
  checkBrazilPair,
  checkCapacity,
  checkEveningWbdEligibility,
  checkEveningWbdNextDay,
  checkExceptions,
  checkForbiddenPairs,
  checkMorningWbdToggle,
  checkNoDuplicateSameDay,
  checkSpecialRules,
  checkSupGteRestrictions,
  checkVacationOnDate,
} from './checks.js';

/** Hard blocks in generator / validation. Manual dashboard edits may warn instead. */
export const MANUAL_WARNING_CODES = new Set(['EVENING_WBD_NEXT_DAY']);

const CHECKS = [
  checkAgentActive,
  checkVacationOnDate,
  checkCapacity,
  checkNoDuplicateSameDay,
  checkSupGteRestrictions,
  checkEveningWbdEligibility,
  checkEveningWbdNextDay,
  checkSpecialRules,
  checkForbiddenPairs,
  checkBrazilPair,
  checkExceptions,
  checkMorningWbdToggle,
];

/**
 * @param {object} agent
 * @param {string} block
 * @param {string} day
 * @param {object} ctx
 * @returns {{ ok: true, warnings?: Array<{ code: string, message: string }> } | { ok: false, code: string, message: string }}
 */
export function canAssign(agent, block, day, ctx = {}) {
  const context = {
    morningWbdLimit: MORNING_WBD_LIMIT,
    ...ctx,
  };
  const warnings = [];
  if (context.morningWbdCheck) {
    const active = checkAgentActive(agent);
    if (!active.ok) return active;
    return checkMorningWbdToggle(agent, block, day, context);
  }
  for (const check of CHECKS) {
    const result = check(agent, block, day, context);
    if (!result.ok) {
      if (context.manualEdit && MANUAL_WARNING_CODES.has(result.code)) {
        warnings.push({ code: result.code, message: result.message });
        continue;
      }
      return result;
    }
  }
  if (warnings.length) return { ok: true, warnings };
  return { ok: true };
}

export { CHECKS };
