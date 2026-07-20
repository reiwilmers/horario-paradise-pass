import { defaultAgentRules } from '../domain/schemas.js';

export function countSpecialRules(agent) {
  const rules = agent?.rules || {};
  const defaults = defaultAgentRules();
  let count = 0;
  if (rules.priorityArea !== defaults.priorityArea) count += 1;
  if (rules.maxSalaPerWeek != null) count += 1;
  if (rules.maxLobbyPerWeek != null) count += 1;
  if (rules.lobbyWeekdaysOnly9AM) count += 1;
  if (rules.noOpening7Weekdays) count += 1;
  if (rules.noLobbyCloseWeekdays) count += 1;
  if (rules.fixedOffDays?.length) count += 1;
  if (rules.fixedPossibleOffDays?.length) count += 1;
  if (rules.cannotShareAreaWith?.length) count += 1;
  if (rules.brazilMarket) count += 1;
  if (rules.brazilPairId) count += 1;
  return count;
}

export function ruleSummary(agent) {
  const count = countSpecialRules(agent);
  return count ? `${count} regla${count === 1 ? '' : 's'}` : 'Sin reglas especiales';
}
