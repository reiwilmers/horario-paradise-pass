import { describe, expect, it } from 'vitest';
import { BLOCK_KEYS, WBD_EVENING_BLOCK } from '../../domain/blocks.js';

describe('blocks', () => {
  it('uses WBD 5:30PM not legacy 4:30', () => {
    expect(WBD_EVENING_BLOCK).toBe('WBD 5:30PM');
    expect(BLOCK_KEYS).not.toContain('WBD 4:30PM');
    expect(BLOCK_KEYS).not.toContain('7:30AM');
  });
});
