import { getState, setVisibleWeek } from './store.js';
import {
  pullCloudState,
  pushLocalIfRicher,
  fetchRemoteOperational,
  isCloudEnabled,
} from './cloud.js';
import { syncForecastCalendar } from './actions/forecast.js';
import { syncApprovedPipeline } from './actions/approved.js';
import { persistVisibleWeek } from './actions/persist.js';
import { showSuccess } from './utils/toast.js';

/** @type {Promise<object> | null} */
let syncInFlight = null;
let lastLifecycleAt = 0;
let pollTimer = null;

const MIN_LIFECYCLE_GAP_MS = 1500;
const POLL_INTERVAL_MS = 8000;

export function getLastSyncLifecycleAt() {
  return lastLifecycleAt;
}

/**
 * Single entry point for calendar rollover + cloud pull (+ admin push).
 * Call on cold start, resume, poll, visibility, and manual Sync.
 */
export async function runSyncLifecycle({
  reason = 'manual',
  notify = false,
  reference = new Date(),
} = {}) {
  if (!isCloudEnabled()) {
    const rolloverResult = await syncForecastCalendar(reference);
    return { changed: Boolean(rolloverResult?.changed), reason, cloudEnabled: false };
  }

  const now = Date.now();
  if (syncInFlight) return syncInFlight;
  if (reason !== 'init' && now - lastLifecycleAt < MIN_LIFECYCLE_GAP_MS) {
    return { changed: false, reason, skipped: true };
  }

  syncInFlight = (async () => {
    try {
      const visibleWeekBefore = getState().visibleWeek;

      const pullChanged = await pullCloudState({
        notify: false,
        reference,
        syncPipeline: false,
      });
      const rolloverResult = await syncForecastCalendar(reference);
      const remoteOperational = await fetchRemoteOperational();
      const pushed = await pushLocalIfRicher(remoteOperational, { reference });

      let changed = pullChanged || pushed;
      if (rolloverResult?.changed) changed = true;

      if (rolloverResult?.rotated && getState().visibleWeek !== 'current') {
        setVisibleWeek('current');
        await persistVisibleWeek();
        changed = true;
      } else if (rolloverResult?.changed && visibleWeekBefore === 'next') {
        setVisibleWeek('current');
        await persistVisibleWeek();
        changed = true;
      }

      if (changed) {
        await syncApprovedPipeline();
      }

      lastLifecycleAt = Date.now();

      if (notify && changed) {
        showSuccess('Horario actualizado.');
      }

      return {
        changed,
        reason,
        pullChanged,
        pushed,
        rolloverChanged: Boolean(rolloverResult?.changed),
        rotated: Boolean(rolloverResult?.rotated),
      };
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

function startSyncPolling() {
  if (!isCloudEnabled() || pollTimer) return;
  pollTimer = setInterval(() => {
    runSyncLifecycle({ reason: 'poll' }).catch(console.error);
  }, POLL_INTERVAL_MS);
}

let lifecycleEventsBound = false;

export function bindSyncLifecycleEvents() {
  if (lifecycleEventsBound) return;
  lifecycleEventsBound = true;
  startSyncPolling();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      runSyncLifecycle({ reason: 'visible' }).catch(console.error);
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      runSyncLifecycle({ reason: 'pageshow' }).catch(console.error);
    }
  });

  window.addEventListener('online', () => {
    runSyncLifecycle({ reason: 'online' }).catch(console.error);
  });
}

export function stopSyncPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}
