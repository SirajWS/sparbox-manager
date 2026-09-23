import { describe, expect, it } from 'vitest';
import { BALANCE_HIDDEN_KEY, MASKED_BALANCE, formatHiddenAmount, loadBalanceHidden, saveBalanceHidden } from './privacy.js';
import { formatTnd } from './money.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); }
  };
}

describe('balance privacy', () => {
  it('stores only the visibility flag locally', () => {
    const storage = memoryStorage();
    expect(loadBalanceHidden(storage)).toBe(false);
    expect(saveBalanceHidden(true, storage)).toBe(true);
    expect(storage.getItem(BALANCE_HIDDEN_KEY)).toBe('1');
    expect(loadBalanceHidden(storage)).toBe(true);
    expect(storage.getItem(BALANCE_HIDDEN_KEY)).toBe('1');
  });

  it('masks displayed amounts without changing the real value', () => {
    expect(formatHiddenAmount(false, 445.63, formatTnd)).toBe(formatTnd(445.63));
    expect(formatHiddenAmount(true, 445.63, formatTnd)).toBe(MASKED_BALANCE);
    expect(formatHiddenAmount(true, 445.63, formatTnd)).not.toContain('445');
  });
});
