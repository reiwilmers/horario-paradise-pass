import { countOperationalAssignments } from './cloudSync.js';

function stableStringify(value) {
  return JSON.stringify(value);
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
    if (stableStringify(localDays) !== stableStringify(remoteDays)) {
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

  if (expected.publisherAgentId && remote.publisherAgentId !== expected.publisherAgentId) {
    return {
      ok: false,
      code: 'PUBLISHER_MISMATCH',
      message: 'La nube no registró al publicador esperado.',
    };
  }

  return { ok: true, updatedAt: remote.updatedAt };
}
