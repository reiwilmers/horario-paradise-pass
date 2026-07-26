import {
  normalizeDailySalesEntry,
  syncMonthlyCertsFromStats,
  entryHasSalesData,
  buildBulkRowEntry,
  datesInMonth,
  JULY_BULK_CATCHUP,
} from '../../domain/agentSalesStats.js';
import {
  getState,
  patchAgentDailySales,
  removeAgentDailySales,
  loadSalesTracking,
} from '../store.js';
import { persistAgentSalesStats, persistSalesTracking } from './persist.js';
import { showSuccess } from '../utils/toast.js';

export async function saveAgentDailySales(agentId, isoDate, rawEntry) {
  const entry = normalizeDailySalesEntry(rawEntry);
  patchAgentDailySales(isoDate, agentId, entry);
  await persistAgentSalesStats();
  const synced = syncMonthlyCertsFromStats(getState().agentSalesStats, getState().salesTracking, agentId, isoDate);
  loadSalesTracking(synced);
  await persistSalesTracking();
  showSuccess('Resultados del día guardados.');
  return { ok: true, entry };
}

export async function saveJulyMonthCatchup(agentId, rawEntry) {
  const entry = buildBulkRowEntry(rawEntry);
  if (!entryHasSalesData(entry)) {
    showSuccess('No había datos para guardar.');
    return { ok: false };
  }

  const stats = getState().agentSalesStats;
  const yearKey = String(stats.year);
  const julyDates = datesInMonth(JULY_BULK_CATCHUP.month, JULY_BULK_CATCHUP.year);
  for (const isoDate of julyDates) {
    if (stats.byYear[yearKey]?.[isoDate]?.[agentId]) {
      removeAgentDailySales(isoDate, agentId);
    }
  }

  patchAgentDailySales(
    JULY_BULK_CATCHUP.anchorDate,
    agentId,
    normalizeDailySalesEntry(entry),
  );
  await persistAgentSalesStats();
  const synced = syncMonthlyCertsFromStats(
    getState().agentSalesStats,
    getState().salesTracking,
    agentId,
    JULY_BULK_CATCHUP.anchorDate,
  );
  loadSalesTracking(synced);
  await persistSalesTracking();
  showSuccess('Totales de julio guardados. Desde mañana usa Registrar día.');
  return { ok: true, entry };
}
