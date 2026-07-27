export const LOCAL_EDITABLE_OPERATIONAL_KEYS = [
  'schedules',
  'morningWbdMap',
  'salesTracking',
  'monthlyGoals',
  'forecasts',
  'forecastSettings',
  'agentSalesStats',
];

export function preserveLocalOperationalFields(remote, local, preserveLocalEditable = false) {
  if (!preserveLocalEditable || !remote) return remote;
  const merged = { ...remote };
  for (const key of LOCAL_EDITABLE_OPERATIONAL_KEYS) {
    if (local?.[key] != null) merged[key] = local[key];
  }
  return merged;
}
