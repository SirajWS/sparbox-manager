import { describe, expect, it } from 'vitest';
import {
  applyDelete,
  applyInsert,
  applyUpdate,
  availableYears,
  bookingFingerprint,
  bookingKindOf,
  bookingTitle,
  bookingToForm,
  canExplicitSave,
  canStartSave,
  categoriesForType,
  employeeAdvanceSummaries,
  filterStaffPayments,
  isBookingAutosaveEnabled,
  isFormComplete,
  preservesBookingIdentity,
  resolveItem,
  staffKindTotals,
  staffYearMonths,
  summarize,
  toAdvancePayload,
  toNormalPayload,
  toStaffPaymentPayload,
  toUpdatePayload
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

describe('staff payments', () => {
  const forms = {
    salary: { bookingKind: 'salary', amount: 800, employeeName: 'Ahmed', date: '2026-03-10', paidBy: 'chedi', note: '' },
    advance: { bookingKind: 'employee_advance', amount: 100, employeeName: 'Ahmed', date: '2026-03-12', paidBy: 'siraj', note: '' },
    tip: { bookingKind: 'tip', amount: 20, employeeName: 'Ahmed', date: '2026-04-01', paidBy: 'other', note: 'service' },
    other: { bookingKind: 'other_staff', amount: 15, employeeName: 'Sara', date: '2026-04-02', paidBy: 'chedi', note: '' }
  };

  it('maps salary, advance, tip and other_staff as single Personal out bookings', () => {
    expect(toStaffPaymentPayload(forms.salary)).toMatchObject({
      type: 'out',
      category: 'Personal',
      item: null,
      booking_kind: 'salary',
      employee_name: 'Ahmed',
      paid_by: 'chedi'
    });
    expect(toStaffPaymentPayload(forms.advance).booking_kind).toBe('employee_advance');
    expect(toStaffPaymentPayload(forms.tip)).toMatchObject({
      booking_kind: 'tip',
      note: 'Trinkgeld – Ahmed: service'
    });
    expect(toStaffPaymentPayload(forms.other).booking_kind).toBe('other_staff');
    expect(toAdvancePayload(forms.advance).booking_kind).toBe('employee_advance');
  });

  it('does not double-count staff payments in dashboard totals', () => {
    const ledger = [
      { id: 'n1', type: 'out', amount: 40, paid_by: 'siraj', booking_kind: 'normal', category: 'Miete' },
      { id: 's1', type: 'out', amount: 800, paid_by: 'chedi', booking_kind: 'salary', category: 'Personal', employee_name: 'Ahmed', date: '2026-03-10' },
      { id: 'a1', type: 'out', amount: 100, paid_by: 'siraj', booking_kind: 'employee_advance', category: 'Personal', employee_name: 'Ahmed', date: '2026-03-12' },
      { id: 't1', type: 'out', amount: 20, paid_by: 'other', booking_kind: 'tip', category: 'Personal', employee_name: 'Ahmed', date: '2026-04-01' },
      { id: 'o1', type: 'out', amount: 15, paid_by: 'chedi', booking_kind: 'other_staff', category: 'Personal', employee_name: 'Sara', date: '2026-04-02' }
    ];
    const totals = summarize(ledger);
    expect(totals.totalOut).toBe(975);
    expect(totals.paidByChedi).toBe(815);
    expect(totals.paidBySiraj).toBe(140);
    const kinds = staffKindTotals(ledger);
    expect(kinds.salary).toBe(800);
    expect(kinds.employee_advance).toBe(100);
    expect(kinds.tip).toBe(20);
    expect(kinds.other_staff).toBe(15);
    expect(kinds.total).toBe(935);
  });

  it('aggregates 12 months including empty months and filters by employee/year', () => {
    const ledger = [
      { id: 's1', type: 'out', amount: 800, paid_by: 'chedi', booking_kind: 'salary', employee_name: 'Ahmed', date: '2026-03-10' },
      { id: 'a1', type: 'out', amount: 100, paid_by: 'siraj', booking_kind: 'employee_advance', employee_name: 'Ahmed', date: '2026-03-12' },
      { id: 't1', type: 'out', amount: 20, paid_by: 'other', booking_kind: 'tip', employee_name: 'Ahmed', date: '2025-04-01' },
      { id: 'o1', type: 'out', amount: 15, paid_by: 'chedi', booking_kind: 'other_staff', employee_name: 'Sara', date: '2026-04-02' }
    ];
    const months = staffYearMonths(ledger, 'Ahmed', 2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ month: 1, total: 0, salary: 0 });
    expect(months[2]).toMatchObject({ month: 3, salary: 800, employee_advance: 100, total: 900 });
    expect(months[3].total).toBe(0);
    expect(filterStaffPayments(ledger, { employeeName: 'Ahmed', year: 2026 })).toHaveLength(2);
    expect(filterStaffPayments(ledger, { employeeName: 'Ahmed', year: 2026, month: 3 })).toHaveLength(2);
    expect(availableYears(ledger, new Date('2026-09-19'))).toEqual([2026, 2025]);
  });

  it('keeps normal bookings working next to staff payments', () => {
    const purchase = toNormalPayload({
      type: 'out',
      amount: 38,
      category: 'Ware / Einkauf',
      item: 'Vanille-Sticks',
      date: '2026-09-17',
      paidBy: 'chedi',
      note: '4 Stück'
    });
    expect(purchase).toMatchObject({
      booking_kind: 'normal',
      employee_name: null,
      item: 'Vanille-Sticks'
    });
    expect(isFormComplete({ ...forms.salary, employeeName: '' })).toBe(false);
    expect(isFormComplete(forms.tip)).toBe(true);
    expect(bookingKindOf({ booking_kind: 'salary' })).toBe('salary');
  });
});

describe('explicit booking save and edit', () => {
  const stored = {
    id: 'keep-me',
    type: 'out',
    amount: 38,
    category: PURCHASE_CATEGORY,
    item: 'Vanille-Sticks',
    note: '4 Stück',
    date: '2026-09-17',
    paid_by: 'chedi',
    booking_kind: 'normal',
    employee_name: null,
    created_at: '2026-09-17T10:00:00Z',
    created_by: 'user-1'
  };

  it('does not auto-save bookings from field events', () => {
    expect(isBookingAutosaveEnabled()).toBe(false);
  });

  it('requires an explicit complete form for exactly one insert', () => {
    expect(canExplicitSave({ complete: false, savingLock: false })).toBe(false);
    expect(canExplicitSave({ complete: true, savingLock: false })).toBe(true);
    expect(canExplicitSave({ complete: true, savingLock: true })).toBe(false);
    expect(isFormComplete({ ...baseForm, amount: '' })).toBe(false);
  });

  it('validates edit data with the same rules as create', () => {
    const form = bookingToForm(stored);
    expect(isFormComplete(form)).toBe(true);
    expect(isFormComplete({ ...form, amount: 0 })).toBe(false);
    expect(isFormComplete({ ...form, paidBy: '' })).toBe(false);
    const staff = bookingToForm({
      ...stored,
      booking_kind: 'salary',
      category: 'Personal',
      item: null,
      employee_name: 'Ahmed',
      note: 'Gehalt – Ahmed'
    });
    expect(staff.bookingKind).toBe('salary');
    expect(isFormComplete(staff)).toBe(true);
    expect(isFormComplete({ ...staff, employeeName: '' })).toBe(false);
  });

  it('keeps UUID and writes UPDATE fields without created_at/created_by', () => {
    const form = bookingToForm({ ...stored, amount: 50 });
    const payload = toUpdatePayload({ ...form, amount: 50 });
    expect(payload.id).toBeUndefined();
    expect(payload.created_at).toBeUndefined();
    expect(payload.created_by).toBeUndefined();
    expect(payload.amount).toBe(50);
    expect(payload.booking_kind).toBe('normal');
    const updated = { ...stored, amount: 50 };
    expect(preservesBookingIdentity(stored, updated)).toBe(true);
    expect(preservesBookingIdentity(stored, { ...updated, id: 'other' })).toBe(false);
  });

  it('replaces a realtime UPDATE in place without a duplicate', () => {
    const list = applyInsert([], stored);
    const next = applyUpdate(list, { ...stored, amount: 90 });
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('keep-me');
    expect(next[0].amount).toBe(90);
    expect(applyUpdate(next, { ...stored, amount: 90 })).toHaveLength(1);
  });

  it('keeps staff booking_kind on edit payload', () => {
    const payload = toUpdatePayload({
      bookingKind: 'tip',
      amount: 25,
      employeeName: 'Ahmed',
      date: '2026-04-01',
      paidBy: 'other',
      note: 'service'
    });
    expect(payload.booking_kind).toBe('tip');
    expect(payload.category).toBe('Personal');
    expect(payload.type).toBe('out');
  });
});
