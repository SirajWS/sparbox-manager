import { describe, expect, it } from 'vitest';
import {
  applyDelete,
  applyInsert,
  bookingFingerprint,
  canStartSave,
  categoriesForType,
  isFormComplete,
  summarize
} from './bookings.js';

const baseForm = {
  type: 'out',
  amount: 85.5,
  category: 'Ware / Einkauf',
  date: '2026-09-18',
  paidBy: 'chedi',
  note: ''
};

describe('booking form completeness', () => {
  it('requires amount, type, category, date and paidBy', () => {
    expect(isFormComplete(baseForm)).toBe(true);
    expect(isFormComplete({ ...baseForm, amount: 0 })).toBe(false);
    expect(isFormComplete({ ...baseForm, category: '' })).toBe(false);
    expect(isFormComplete({ ...baseForm, paidBy: '' })).toBe(false);
    expect(isFormComplete({ ...baseForm, note: '' })).toBe(true);
  });
});

describe('auto-save without timer', () => {
  it('blocks a second insert while savingLock is active', () => {
    const fingerprint = bookingFingerprint(baseForm);
    expect(canStartSave({
      complete: true,
      fingerprint,
      savingLock: true,
      inFlightFingerprint: fingerprint
    })).toBe(false);
  });

  it('blocks Enter + Blur of the same in-flight booking', () => {
    const fingerprint = bookingFingerprint(baseForm);
    expect(canStartSave({
      complete: true,
      fingerprint,
      savingLock: false,
      inFlightFingerprint: fingerprint
    })).toBe(false);
  });

  it('allows a new amount after the previous save finished', () => {
    expect(canStartSave({
      complete: true,
      fingerprint: bookingFingerprint({ ...baseForm, amount: 12 }),
      savingLock: false,
      inFlightFingerprint: null
    })).toBe(true);
  });

  it('does not save an incomplete mask', () => {
    expect(canStartSave({
      complete: false,
      fingerprint: 'partial',
      savingLock: false,
      inFlightFingerprint: null
    })).toBe(false);
  });
});

describe('bookings source of truth', () => {
  const rows = [
    { id: 'a', type: 'in', amount: '100.000', paid_by: 'siraj' },
    { id: 'b', type: 'out', amount: '20.500', paid_by: 'siraj' },
    { id: 'c', type: 'out', amount: '10.000', paid_by: 'chedi' },
    { id: 'd', type: 'in', amount: '5.000', paid_by: 'chedi' }
  ];

  it('sums deposits, expenses and paid-by expense totals separately', () => {
    expect(summarize(rows)).toEqual({
      totalIn: 105,
      totalOut: 30.5,
      balance: 74.5,
      paidBySiraj: 20.5,
      paidByChedi: 10
    });
  });

  it('deduplicates realtime inserts by id', () => {
    const once = applyInsert([], { id: 'a', amount: 1 });
    const twice = applyInsert(once, { id: 'a', amount: 1 });
    expect(twice).toHaveLength(1);
  });

  it('removes a deleted booking by id', () => {
    expect(applyDelete(rows, 'b').map((row) => row.id)).toEqual(['a', 'c', 'd']);
  });

  it('switches categories with booking type', () => {
    expect(categoriesForType('out')).toContain('Ware / Einkauf');
    expect(categoriesForType('in')).toContain('Investition / Einlage');
    expect(categoriesForType('in')).not.toContain('Miete');
  });
});
