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
} from './checks.js';

const CHECKS = [
  checkAgentActive,
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
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function canAssign(agent, block, day, ctx = {}) {
  const context = {
    morningWbdLimit: MORNING_WBD_LIMIT,
    ...ctx,
  };
  for (const check of CHECKS) {
    const result = check(agent, block, day, context);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export { CHECKS };
