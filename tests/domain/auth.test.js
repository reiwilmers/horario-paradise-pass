import { describe, expect, it } from 'vitest';
import {
  TEMPORARY_PASSWORD,
  passwordForAgent,
  verifyAgentLogin,
  buildRememberedLogin,
} from '../../domain/auth.js';

describe('auth', () => {
  it('uses 1234 when collaborator number is missing', () => {
    expect(passwordForAgent({ collaboratorNumber: '' })).toBe(TEMPORARY_PASSWORD);
    expect(passwordForAgent({ collaboratorNumber: '   ' })).toBe(TEMPORARY_PASSWORD);
  });

  it('uses collaborator number as password when assigned', () => {
    expect(passwordForAgent({ collaboratorNumber: '1001' })).toBe('1001');
  });

  it('rejects inactive agents and wrong passwords', () => {
    const agent = { active: false, collaboratorNumber: '' };
    expect(verifyAgentLogin(agent, '1234').ok).toBe(false);

    const active = { active: true, collaboratorNumber: '5678' };
    expect(verifyAgentLogin(active, '1234').ok).toBe(false);
    expect(verifyAgentLogin(active, '5678').ok).toBe(true);
  });

  it('stores password only when remember password is enabled', () => {
    const prefs = buildRememberedLogin({
      agentId: 'rei',
      password: '1234',
      rememberUser: true,
      rememberPassword: false,
    });
    expect(prefs.agentId).toBe('rei');
    expect(prefs.password).toBe('');
  });
});
