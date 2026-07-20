import * as db from '../db.js';
import { getState, setCurrentUserId, isAdminUser } from '../store.js';
import {
  verifyAgentLogin,
  buildRememberedLogin,
  emptyRememberedLogin,
  normalizeRememberedLogin,
} from '../../domain/auth.js';

export async function loadRememberedLogin() {
  const stored = await db.getSetting('rememberedLogin');
  return normalizeRememberedLogin(stored?.value || emptyRememberedLogin());
}

export async function persistRememberedLogin(prefs) {
  await db.setSetting('rememberedLogin', normalizeRememberedLogin(prefs));
}

export function attemptLogin({ agentId, password, rememberUser, rememberPassword }) {
  const agent = getState().agents.byId[agentId];
  if (!agent) {
    return { ok: false, message: 'Agente no encontrado.' };
  }
  const check = verifyAgentLogin(agent, password);
  if (!check.ok) return check;

  const remembered = buildRememberedLogin({ agentId, password, rememberUser, rememberPassword });
  setCurrentUserId(agentId);
  return {
    ok: true,
    agent,
    remembered,
    defaultPage: isAdminUser() ? 'dashboard' : 'horario',
  };
}

export async function completeLogin(result) {
  await persistRememberedLogin(result.remembered);
  await db.setSetting('currentUserId', result.agent.id);
}

export async function clearLoginSession(remembered) {
  setCurrentUserId(null, true);
  if (!remembered?.rememberUser) {
    await persistRememberedLogin(emptyRememberedLogin());
  } else if (!remembered?.rememberPassword) {
    await persistRememberedLogin({
      ...remembered,
      password: '',
    });
  }
}
