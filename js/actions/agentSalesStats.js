import {
  normalizeDailySalesEntry,
  syncMonthlyCertsFromStats,
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
