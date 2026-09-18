export const EMPLOYEE_NAME_MAX = 60;

export function normalizeEmployeeName(raw) {
  return String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
}

export function employeeNameKey(name) {
  return normalizeEmployeeName(name).toLocaleLowerCase('de-DE');
}

export function validateEmployeeName(raw, existing = []) {
  const name = normalizeEmployeeName(raw);
  if (!name) return { ok: false, error: 'empty' };
  if (name.length > EMPLOYEE_NAME_MAX) return { ok: false, error: 'too_long' };
  const key = employeeNameKey(name);
  const duplicate = existing.some((entry) => employeeNameKey(entry?.name ?? entry) === key);
  if (duplicate) return { ok: false, error: 'duplicate', name };
  return { ok: true, name };
}

export function canRecordAdvance(employees) {
  return Array.isArray(employees) && employees.some((entry) => normalizeEmployeeName(entry?.name ?? entry));
}

export function applyEmployeeInsert(list, employee) {
  if (!employee || !employee.id) return list;
  if (list.some((item) => item.id === employee.id)) return list;
  return [...list, employee].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
}

export function applyEmployeeDelete(list, id) {
  if (!id) return list;
  return list.filter((item) => item.id !== id);
}

export function deletingEmployeeKeepsBookings(bookingsBefore, bookingsAfter) {
  return JSON.stringify(bookingsBefore) === JSON.stringify(bookingsAfter);
}
