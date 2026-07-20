import { getState, patchSalesValue } from '../store.js';
import { persistSalesTracking } from './persist.js';

export async function setSalesValue(month, agentId, value) {
  patchSalesValue(month, agentId, value);
  await persistSalesTracking();
}
