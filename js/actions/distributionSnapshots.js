import { snapshotFromLiveWeek } from '../../domain/monthlyDistribution.js';
import { getState, upsertDistributionSnapshot } from '../store.js';
import { persistDistributionSnapshots } from './persist.js';

export async function captureDistributionSnapshotForWeek(weekKey, { persist = true } = {}) {
  const snapshot = snapshotFromLiveWeek(getState(), weekKey);
  if (!snapshot) return null;
  upsertDistributionSnapshot(snapshot.mondayIso, snapshot);
  if (persist) await persistDistributionSnapshots();
  return snapshot;
}

export async function captureLiveDistributionSnapshots() {
  let captured = false;
  for (const weekKey of ['current', 'next']) {
    const snapshot = snapshotFromLiveWeek(getState(), weekKey);
    if (!snapshot) continue;
    upsertDistributionSnapshot(snapshot.mondayIso, snapshot);
    captured = true;
  }
  if (captured) await persistDistributionSnapshots();
}
