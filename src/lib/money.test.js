import { describe, expect, it } from 'vitest';
import { formatTnd, isPositiveAmount, parseAmount, roundAmount } from './money.js';

describe('TND amounts', () => {
  it('formats with three millime digits', () => {
    expect(formatTnd(5)).toBe('5,000 TND');
    expect(formatTnd(25.5)).toBe('25,500 TND');
    expect(formatTnd(150)).toBe('150,000 TND');
    expect(formatTnd(85.5)).toBe('85,500 TND');
  });

  it('parses comma and dot decimals', () => {
    expect(parseAmount('85,500')).toBe(85.5);
    expect(parseAmount('150,000')).toBe(150);
    expect(parseAmount('25.500')).toBe(25.5);
    expect(parseAmount('150')).toBe(150);
  });

  it('does not treat empty or zero as a valid booking amount', () => {
    expect(isPositiveAmount('')).toBe(false);
    expect(isPositiveAmount(0)).toBe(false);
    expect(isPositiveAmount('0,000')).toBe(false);
    expect(isPositiveAmount(85.5)).toBe(true);
  });

  it('rounds to millimes', () => {
    expect(roundAmount(1.2344)).toBe(1.234);
    expect(roundAmount(1.2345)).toBe(1.235);
  });
});
