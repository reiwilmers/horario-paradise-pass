import { DAYS } from './constants.js';
import { countOperationalAssignments } from './cloudSync.js';
import { parseDayPlan } from './schemas.js';
import { MORNING_WBD_BLOCKS } from './blocks.js';
import { findAgentBlock } from './schedule.js';

export function canonicalScheduleDays(days = {}) {
  const out = {};
  for (const day of DAYS) {
    out[day] = parseDayPlan(days?.[day]);
  }
  return out;
}

function canonicalMorningWbdMap(map = {}, schedules = {}) {
  const out = {};
  for (const day of DAYS) {
    const ids = (map[day] || []).filter(Boolean);
    out[day] = [...new Set(ids.filter((agentId) => {
      const inCurrent = MORNING_WBD_BLOCKS.includes(
        findAgentBlock(schedules?.current?.days?.[day], agentId),
      );
      const inNext = MORNING_WBD_BLOCKS.includes(
        findAgentBlock(schedules?.next?.days?.[day], agentId),
      );
      return inCurrent || inNext;
    }))].sort();
  }
  return out;
}

function schedulesDaysEqual(left = {}, right = {}) {
  return JSON.stringify(canonicalScheduleDays(left))
    === JSON.stringify(canonicalScheduleDays(right));
}

/**
 * Verify that remote cloud payload matches what we intended to publish.
 */
export function verifyOperationalPayload(expected, remote) {
  if (!remote?.updatedAt) {
    return { ok: false, code: 'EMPTY_REMOTE', message: 'La nube no devolvió datos operacionales.' };
  }
  if (!expected) {
    return { ok: false, code: 'EMPTY_LOCAL', message: 'No hay payload local para verificar.' };
  }

  const expectedCount = countOperationalAssignments(expected);
  const remoteCount = countOperationalAssignments(remote);
  if (expectedCount !== remoteCount) {
    return {
      ok: false,
      code: 'ASSIGNMENT_COUNT',
      message: `Asignaciones distintas (${expectedCount} local vs ${remoteCount} nube).`,
      expectedCount,
      remoteCount,
    };
  }

  const weeks = ['current', 'next'];
  for (const weekKey of weeks) {
    const localDays = expected.schedules?.[weekKey]?.days;
    const remoteDays = remote.schedules?.[weekKey]?.days;
    if (!schedulesDaysEqual(localDays, remoteDays)) {
      return {
        ok: false,
        code: 'SCHEDULE_MISMATCH',
        message: `El horario (${weekKey}) en la nube no coincide con lo enviado.`,
        weekKey,
      };
    }
    const localMonday = expected.schedules?.[weekKey]?.mondayIso || '';
    const remoteMonday = remote.schedules?.[weekKey]?.mondayIso || '';
    if (localMonday && remoteMonday && localMonday !== remoteMonday) {
      return {
        ok: false,
        code: 'WEEK_MISMATCH',
        message: `La semana (${weekKey}) tiene fechas distintas en la nube.`,
        weekKey,
        localMonday,
        remoteMonday,
      };
    }
  }

  const expectedWbd = canonicalMorningWbdMap(
    expected.morningWbdMap,
    expected.schedules,
  );
  const remoteWbd = canonicalMorningWbdMap(
    remote.morningWbdMap,
    remote.schedules,
  );
  if (JSON.stringify(expectedWbd) !== JSON.stringify(remoteWbd)) {
    return {
      ok: false,
      code: 'WBD_MAP_MISMATCH',
      message: 'Los WBD mañana en la nube no coinciden con lo enviado.',
    };
  }

  if (expected.publisherAgentId && remote.publisherAgentId !== expected.publisherAgentId) {
    return {
      ok: false,
      code: 'PUBLISHER_MISMATCH',
      message: 'La nube no registró al publicador esperado.',
    };
  }

  return { ok: true, updatedAt: remote.updatedAt };
}
