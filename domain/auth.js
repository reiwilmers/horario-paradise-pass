export const TEMPORARY_PASSWORD = '1234';

export function passwordForAgent(agent) {
  const collaborator = String(agent?.collaboratorNumber || '').trim();
  return collaborator || TEMPORARY_PASSWORD;
}

export function verifyAgentLogin(agent, password) {
  if (!agent?.active) {
    return { ok: false, code: 'INACTIVE', message: 'Este agente está inactivo.' };
  }
  const expected = passwordForAgent(agent);
  if (String(password ?? '') !== expected) {
    return {
      ok: false,
      code: 'INVALID_PASSWORD',
      message: 'Nombre o contraseña incorrecta. Usa 1234 si aún no tienes número de colaborador.',
    };
  }
  return { ok: true };
}

export function emptyRememberedLogin() {
  return {
    rememberUser: false,
    rememberPassword: false,
    agentId: '',
    password: '',
  };
}

export function normalizeRememberedLogin(raw = {}) {
  return {
    rememberUser: Boolean(raw.rememberUser),
    rememberPassword: Boolean(raw.rememberPassword),
    agentId: String(raw.agentId || '').trim(),
    password: String(raw.password || ''),
  };
}

export function buildRememberedLogin({ agentId, password, rememberUser, rememberPassword }) {
  return normalizeRememberedLogin({
    rememberUser,
    rememberPassword: rememberPassword && rememberUser,
    agentId: rememberUser ? agentId : '',
    password: rememberPassword && rememberUser ? password : '',
  });
}
