import { describe, expect, it } from 'vitest';
import {
  applyDelete,
  applyInsert,
  bookingFingerprint,
  bookingKindOf,
  bookingTitle,
  canStartSave,
  categoriesForType,
  employeeAdvanceSummaries,
  isFormComplete,
  resolveItem,
  summarize,
  toAdvancePayload,
  toNormalPayload
} from './bookings.js';
import { CUSTOM_ITEM, PURCHASE_CATEGORY, PURCHASE_ITEMS } from './catalog.js';

const baseForm = {
  type: 'out',
  amount: 85.5,
  category: PURCHASE_CATEGORY,
  item: 'Thunfisch',
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

  it('requires an item for Ware / Einkauf', () => {
    expect(isFormComplete({ ...baseForm, item: '' })).toBe(false);
    expect(resolveItem({ ...baseForm, item: 'Thunfisch' })).toBe('Thunfisch');
  });

  it('requires a custom name when article is Sonstiges', () => {
    const other = { ...baseForm, item: CUSTOM_ITEM, itemName: '' };
    expect(isFormComplete(other)).toBe(false);
    expect(isFormComplete({ ...other, itemName: 'Mayonnaise' })).toBe(true);
    expect(resolveItem({ ...other, itemName: 'Mayonnaise' })).toBe('Mayonnaise');
  });

  it('stores no item for non-purchase categories', () => {
    const rent = { ...baseForm, category: 'Miete', item: 'Thunfisch' };
    expect(isFormComplete(rent)).toBe(true);
    expect(resolveItem(rent)).toBe(null);
    expect(toNormalPayload(rent).item).toBe(null);
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

  it('treats an advance as complete only with employee, amount, date and paidBy', () => {
    const advance = {
      bookingKind: 'employee_advance',
      amount: 100,
      employeeName: 'Mitarbeiter A',
      date: '2026-09-18',
      paidBy: 'chedi',
      note: ''
    };
    expect(isFormComplete(advance)).toBe(true);
    expect(isFormComplete({ ...advance, employeeName: '' })).toBe(false);
    expect(isFormComplete({ ...advance, amount: 0 })).toBe(false);
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

  it('keeps a single purchase-item list', () => {
    expect(PURCHASE_ITEMS).toContain('Thunfisch');
    expect(PURCHASE_ITEMS[PURCHASE_ITEMS.length - 1]).toBe('Sonstiges');
  });

  it('treats employee advances as normal expenses exactly once', () => {
    const ledger = [
      { id: 'n1', type: 'out', amount: 40, paid_by: 'siraj', booking_kind: 'normal' },
      {
        id: 'v1',
        type: 'out',
        amount: 100,
        paid_by: 'chedi',
        category: 'Personal',
        booking_kind: 'employee_advance',
        employee_name: 'Mitarbeiter A'
      },
      {
        id: 'v2',
        type: 'out',
        amount: 25,
        paid_by: 'siraj',
        category: 'Personal',
        booking_kind: 'employee_advance',
        employee_name: 'Mitarbeiter A'
      }
    ];
    const totals = summarize(ledger);
    expect(totals.totalOut).toBe(165);
    expect(totals.paidByChedi).toBe(100);
    expect(totals.paidBySiraj).toBe(65);
    expect(employeeAdvanceSummaries(ledger, [{ name: 'Mitarbeiter A' }])[0].total).toBe(125);
    expect(bookingKindOf(ledger[1])).toBe('employee_advance');
  });

  it('maps an advance to a Personal booking without a second ledger', () => {
    const payload = toAdvancePayload({
      amount: 100,
      employeeName: 'Mitarbeiter A',
      date: '2026-09-18',
      paidBy: 'chedi',
      note: ''
    });
    expect(payload).toMatchObject({
      type: 'out',
      category: 'Personal',
      item: null,
      booking_kind: 'employee_advance',
      employee_name: 'Mitarbeiter A',
      paid_by: 'chedi',
      note: 'Vorschuss – Mitarbeiter A'
    });
  });

  it('still reads old bookings without optional fields', () => {
    const legacy = [{ id: 'old', type: 'out', amount: '12.000', paid_by: 'chedi', category: 'Miete' }];
    expect(summarize(legacy).totalOut).toBe(12);
    expect(bookingKindOf(legacy[0])).toBe('normal');
    expect(resolveItem({ type: 'out', category: 'Miete' })).toBe(null);
    expect(bookingTitle(legacy[0])).toBe('Miete');
  });
});
