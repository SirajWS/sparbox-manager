export const BALANCE_HIDDEN_KEY = 'mixmax-balance-hidden';
export const MASKED_BALANCE = '•••••• TND';

export function loadBalanceHidden(storage) {
  if (!storage || typeof storage.getItem !== 'function') return false;
  try {
    return storage.getItem(BALANCE_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveBalanceHidden(hidden, storage) {
  const next = Boolean(hidden);
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(BALANCE_HIDDEN_KEY, next ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }
  return next;
}

export function formatHiddenAmount(hidden, value, formatTnd) {
  return hidden ? MASKED_BALANCE : formatTnd(value);
}
