import { describe, expect, it } from 'vitest';
import {
  applyEmployeeDelete,
  applyEmployeeInsert,
  canRecordAdvance,
  deletingEmployeeKeepsBookings,
  employeeNameKey,
  normalizeEmployeeName,
  validateEmployeeName
} from './employees.js';
import { applyDelete, isFormComplete, toAdvancePayload } from './bookings.js';

describe('employees', () => {
  it('trims employee names', () => {
    expect(normalizeEmployeeName('  Ahmed   Ali  ')).toBe('Ahmed Ali');
    expect(employeeNameKey('Ahmed')).toBe(employeeNameKey('ahmed'));
  });

  it('rejects an empty employee name', () => {
    expect(validateEmployeeName('   ').ok).toBe(false);
    expect(validateEmployeeName('   ').error).toBe('empty');
  });

  it('detects duplicates ignoring case', () => {
    const existing = [{ id: '1', name: 'Ahmed' }];
    expect(validateEmployeeName('ahmed', existing).error).toBe('duplicate');
    expect(validateEmployeeName('Sara', existing).ok).toBe(true);
  });

  it('adds and removes employees by id', () => {
    const added = applyEmployeeInsert([], { id: 'e1', name: 'Ahmed' });
    expect(added).toHaveLength(1);
    expect(applyEmployeeInsert(added, { id: 'e1', name: 'Ahmed' })).toHaveLength(1);
    expect(applyEmployeeDelete(added, 'e1')).toEqual([]);
  });

  it('does not allow an advance without employees', () => {
    expect(canRecordAdvance([])).toBe(false);
    expect(canRecordAdvance([{ id: 'e1', name: 'Ahmed' }])).toBe(true);
    expect(isFormComplete({
      bookingKind: 'employee_advance',
      amount: 100,
      employeeName: '',
      date: '2026-09-18',
      paidBy: 'chedi'
    })).toBe(false);
  });

  it('uses the selected employee name on an advance booking', () => {
    const payload = toAdvancePayload({
      amount: 100,
      employeeName: 'Ahmed',
      date: '2026-09-18',
      paidBy: 'chedi',
      note: ''
    });
    expect(payload.employee_name).toBe('Ahmed');
    expect(payload.booking_kind).toBe('employee_advance');
    expect(payload.category).toBe('Personal');
  });

  it('keeps bookings when an employee is removed', () => {
    const bookings = [
      { id: 'v1', type: 'out', amount: 100, booking_kind: 'employee_advance', employee_name: 'Ahmed' },
      { id: 's1', type: 'out', amount: 800, booking_kind: 'salary', employee_name: 'Ahmed' },
      { id: 't1', type: 'out', amount: 20, booking_kind: 'tip', employee_name: 'Ahmed' },
      { id: 'o1', type: 'out', amount: 15, booking_kind: 'other_staff', employee_name: 'Ahmed' }
    ];
    const employees = [{ id: 'e1', name: 'Ahmed' }];
    const nextEmployees = applyEmployeeDelete(employees, 'e1');
    expect(nextEmployees).toEqual([]);
    expect(deletingEmployeeKeepsBookings(bookings, bookings)).toBe(true);
    expect(applyDelete(bookings, 'e1')).toHaveLength(4);
    expect(bookings.map((row) => row.employee_name)).toEqual(['Ahmed', 'Ahmed', 'Ahmed', 'Ahmed']);
    expect(bookings.map((row) => row.booking_kind)).toEqual(['employee_advance', 'salary', 'tip', 'other_staff']);
  });
});
