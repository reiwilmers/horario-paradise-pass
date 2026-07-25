import { appendScheduleLearningEvent } from '../../domain/scheduleLearning.js';
import { getState, loadScheduleLearning } from '../store.js';
import { persistScheduleLearning } from './persist.js';

export async function recordScheduleAdjustment({
  weekKey = 'current',
  agentId,
  day,
  fromBlock = '',
  toBlock,
  category = '',
}) {
  if (!agentId || !day || !toBlock || fromBlock === toBlock) return;
  const next = appendScheduleLearningEvent(getState().scheduleLearning, {
    weekKey,
    agentId,
    day,
    fromBlock,
    toBlock,
    category,
    at: Date.now(),
  });
  loadScheduleLearning(next);
  await persistScheduleLearning();
}
