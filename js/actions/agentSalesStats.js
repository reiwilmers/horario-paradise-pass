import {
  normalizeDailySalesEntry,
  syncMonthlyCertsFromStats,
  entryHasSalesData,
  buildBulkRowEntry,
} from '../../domain/agentSalesStats.js';
import {
  getState,
  patchAgentDailySales,
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

export async function saveJulyBulkEntries(agentId, rows = []) {
  let saved = 0;
  for (const row of rows) {
    const entry = buildBulkRowEntry(row.entry);
    if (!entryHasSalesData(entry)) continue;
    const existing = getState().agentSalesStats.byYear[String(getState().agentSalesStats.year)]?.[row.isoDate]?.[agentId] || {};
    patchAgentDailySales(row.isoDate, agentId, normalizeDailySalesEntry({
      ...existing,
      ...entry,
    }));
    saved += 1;
  }
  if (!saved) {
    showSuccess('No había filas con datos para guardar.');
    return { ok: false, saved: 0 };
  }
  await persistAgentSalesStats();
  const isoDate = rows.at(-1)?.isoDate || new Date().toISOString().slice(0, 10);
  const synced = syncMonthlyCertsFromStats(getState().agentSalesStats, getState().salesTracking, agentId, isoDate);
  loadSalesTracking(synced);
  await persistSalesTracking();
  showSuccess(`Julio guardado (${saved} día${saved === 1 ? '' : 's'}).`);
  return { ok: true, saved };
}
