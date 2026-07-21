import { describe, expect, it } from 'vitest';
import { isAdminAgent } from '../../domain/constants.js';

describe('admin access', () => {
  it('treats SUP and GTE categories as admin', () => {
    expect(isAdminAgent({ id: 'persis', category: 'SUP' })).toBe(true);
    expect(isAdminAgent({ id: 'rei', category: 'GTE' })).toBe(true);
  });

  it('treats Cris as GTE admin even with wrong category', () => {
    expect(isAdminAgent({ id: 'cris', category: 'MA' })).toBe(true);
    expect(isAdminAgent({ id: 'cris', category: 'GTE' })).toBe(true);
  });

  it('does not grant admin to regular agents', () => {
    expect(isAdminAgent({ id: 'sebas', category: 'TOP' })).toBe(false);
  });
});
