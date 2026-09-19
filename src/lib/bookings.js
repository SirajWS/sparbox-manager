import { isPositiveAmount, roundAmount } from './money.js';
import { CUSTOM_ITEM, PERSONNEL_CATEGORY, PURCHASE_CATEGORY } from './catalog.js';

export const BOOKING_TYPES = {
  out: 'Ausgabe',
  in: 'Einzahlung'
};

export const PAID_BY = {
  siraj: 'Siraj',
  chedi: 'Chedi',
  other: 'Andere'
};

export const OUT_CATEGORIES = [
  'Ware / Einkauf',
  'Miete',
  'Personal',
  'Ausstattung',
  'POS / Kasse',
  'Reparatur',
  'Transport',
  'Sonstiges'
];

export const IN_CATEGORIES = [
  'Investition / Einlage',
  'Einnahme',
  'Rückzahlung',
  'Sonstiges'
];

export function categoriesForType(type) {
  return type === 'in' ? IN_CATEGORIES : OUT_CATEGORIES;
}

export function paidByLabel(paidBy) {
  return PAID_BY[paidBy] || paidBy || '–';
}

export function typeLabel(type) {
  return BOOKING_TYPES[type] || type || '–';
}

export function isPurchaseCategory(category) {
  return category === PURCHASE_CATEGORY;
}

export function needsCustomItemName(form) {
  return form.type === 'out'
    && isPurchaseCategory(form.category)
    && form.item === CUSTOM_ITEM;
}

export function resolveItem(form) {
  if (form.type !== 'out' || !isPurchaseCategory(form.category)) return null;
  const selected = String(form.item || '').trim();
  if (!selected) return null;
  if (selected === CUSTOM_ITEM) {
    const custom = String(form.itemName || '').trim();
    return custom || null;
  }
  return selected;
}

export const STAFF_PAYMENT_KINDS = ['salary', 'employee_advance', 'tip', 'other_staff'];

export const STAFF_NOTE_PREFIX = {
  salary: 'Gehalt',
  employee_advance: 'Vorschuss',
  tip: 'Trinkgeld',
  other_staff: 'Sonstiges'
};

export const EMPTY_STAFF_TOTALS = {
  salary: 0,
  employee_advance: 0,
  tip: 0,
  other_staff: 0,
  total: 0
};

export function isStaffPaymentKind(kind) {
  return STAFF_PAYMENT_KINDS.includes(kind);
}

export function bookingKindOf(bookingOrForm) {
  const kind = bookingOrForm?.bookingKind || bookingOrForm?.booking_kind;
  return isStaffPaymentKind(kind) ? kind : 'normal';
}

export function isEmployeeAdvance(booking) {
  return bookingKindOf(booking) === 'employee_advance';
}

export function isStaffPayment(booking) {
  return isStaffPaymentKind(bookingKindOf(booking)) && booking?.type !== 'in';
}

export function isFormComplete(form) {
  if (isStaffPaymentKind(bookingKindOf(form))) {
    return isPositiveAmount(form.amount)
      && Boolean(String(form.employeeName || '').trim())
      && Boolean(form.date)
      && Boolean(PAID_BY[form.paidBy]);
  }

  if (!isPositiveAmount(form.amount)
    || (form.type !== 'in' && form.type !== 'out')
    || !form.category
    || !form.date
    || !PAID_BY[form.paidBy]) {
    return false;
  }

  if (form.type === 'out' && isPurchaseCategory(form.category) && !resolveItem(form)) {
    return false;
  }

  return true;
}

export function bookingFingerprint(form) {
  return [
    bookingKindOf(form),
    form.type || 'out',
    roundAmount(form.amount),
    form.category || '',
    resolveItem(form) || '',
    form.date || '',
    form.paidBy || '',
    String(form.employeeName || '').trim(),
    String(form.note || '').trim()
  ].join('|');
}

export function canStartSave({ complete, fingerprint, savingLock, inFlightFingerprint }) {
  if (savingLock) return false;
  if (!complete) return false;
  if (inFlightFingerprint && fingerprint === inFlightFingerprint) return false;
  return true;
}

export function sortNewestFirst(bookings) {
  return [...bookings].sort((a, b) => {
    const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCmp) return dateCmp;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

export function sortOldestFirst(bookings) {
  return sortNewestFirst(bookings).reverse();
}

export function applyInsert(list, booking) {
  if (!booking || !booking.id) return list;
  if (list.some((item) => item.id === booking.id)) return list;
  return [booking, ...list];
}

export function applyDelete(list, id) {
  if (!id) return list;
  return list.filter((item) => item.id !== id);
}

export function summarize(bookings) {
  let totalIn = 0;
  let totalOut = 0;
  let paidBySiraj = 0;
  let paidByChedi = 0;

  for (const booking of bookings) {
    const amount = Number(booking.amount);
    if (!Number.isFinite(amount)) continue;
    if (booking.type === 'in') {
      totalIn += amount;
    } else if (booking.type === 'out') {
      totalOut += amount;
      if (booking.paid_by === 'siraj') paidBySiraj += amount;
      if (booking.paid_by === 'chedi') paidByChedi += amount;
    }
  }

  return {
    totalIn,
    totalOut,
    balance: totalIn - totalOut,
    paidBySiraj,
    paidByChedi
  };
}

export function runningBalances(bookings) {
  const chronological = sortOldestFirst(bookings);
  let stand = 0;
  const byId = {};
  for (const booking of chronological) {
    const amount = Number(booking.amount) || 0;
    stand += booking.type === 'in' ? amount : -amount;
    byId[booking.id] = stand;
  }
  return byId;
}

export function employeeAdvances(bookings) {
  return sortNewestFirst(bookings.filter((booking) => isEmployeeAdvance(booking) && booking.type === 'out'));
}

export function staffPayments(bookings) {
  return sortNewestFirst((bookings || []).filter((booking) => isStaffPayment(booking) && booking.type === 'out'));
}

export function staffEmployeeNames(bookings, employees = []) {
  const names = [];
  for (const entry of employees) {
    const name = typeof entry === 'string' ? entry : entry?.name;
    if (name && !names.includes(name)) names.push(name);
  }
  for (const row of staffPayments(bookings)) {
    const name = String(row.employee_name || '').trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function employeeAdvanceSummaries(bookings, employees = []) {
  const rows = employeeAdvances(bookings);
  const names = [];
  for (const entry of employees) {
    const name = typeof entry === 'string' ? entry : entry?.name;
    if (name && !names.includes(name)) names.push(name);
  }
  for (const row of rows) {
    const name = String(row.employee_name || '').trim();
    if (name && !names.includes(name)) names.push(name);
  }

  return names.map((name) => {
    const history = rows.filter((row) => row.employee_name === name);
    const total = history.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return {
      name,
      total,
      last: history[0] || null,
      history
    };
  });
}

export function staffPaymentSummaries(bookings, employees = []) {
  const rows = staffPayments(bookings);
  return staffEmployeeNames(bookings, employees).map((name) => {
    const history = rows.filter((row) => row.employee_name === name);
    const total = history.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return {
      name,
      total,
      last: history[0] || null,
      history
    };
  });
}

export function availableYears(bookings, now = new Date()) {
  const years = new Set([now.getFullYear()]);
  for (const booking of bookings || []) {
    const year = Number(String(booking.date || '').slice(0, 4));
    if (Number.isFinite(year) && year > 1900 && year < 3000) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

export function filterStaffPayments(bookings, { employeeName, year, month } = {}) {
  return staffPayments(bookings).filter((booking) => {
    if (employeeName && booking.employee_name !== employeeName) return false;
    const date = String(booking.date || '');
    if (year && Number(date.slice(0, 4)) !== Number(year)) return false;
    if (month) {
      const value = String(month).padStart(2, '0');
      if (date.slice(5, 7) !== value) return false;
    }
    return true;
  });
}

export function staffKindTotals(bookings) {
  const totals = { ...EMPTY_STAFF_TOTALS };
  for (const booking of bookings || []) {
    if (!isStaffPayment(booking) || booking.type !== 'out') continue;
    const kind = bookingKindOf(booking);
    const amount = Number(booking.amount);
    if (!Number.isFinite(amount)) continue;
    totals[kind] += amount;
    totals.total += amount;
  }
  return totals;
}

export function staffYearMonths(bookings, employeeName, year) {
  const rows = filterStaffPayments(bookings, { employeeName, year });
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthRows = rows.filter((booking) => Number(String(booking.date || '').slice(5, 7)) === month);
    return {
      month,
      ...staffKindTotals(monthRows)
    };
  });
}

export function staffPaymentNote(kind, employeeName, note) {
  const custom = String(note || '').trim();
  const prefix = STAFF_NOTE_PREFIX[kind] || 'Personal';
  const label = `${prefix} – ${String(employeeName || '').trim()}`;
  return custom ? `${label}: ${custom}` : label;
}

export function advanceNote(employeeName, note) {
  return staffPaymentNote('employee_advance', employeeName, note);
}

export function toStaffPaymentPayload(form) {
  const employeeName = String(form.employeeName || '').trim();
  const kind = isStaffPaymentKind(bookingKindOf(form)) ? bookingKindOf(form) : 'employee_advance';
  return {
    type: 'out',
    amount: roundAmount(form.amount),
    currency: 'TND',
    category: PERSONNEL_CATEGORY,
    item: null,
    note: staffPaymentNote(kind, employeeName, form.note),
    date: form.date,
    paid_by: form.paidBy,
    booking_kind: kind,
    employee_name: employeeName
  };
}

export function toAdvancePayload(form) {
  return toStaffPaymentPayload({ ...form, bookingKind: form.bookingKind || 'employee_advance' });
}

export function toNormalPayload(form) {
  return {
    type: form.type,
    amount: roundAmount(form.amount),
    currency: 'TND',
    category: form.category,
    item: resolveItem(form),
    note: String(form.note || '').trim() || null,
    date: form.date,
    paid_by: form.paidBy,
    booking_kind: 'normal',
    employee_name: null
  };
}

export function bookingTitle(booking, labels = { advance: 'Vorschuss', employee: 'Mitarbeiter' }) {
  const kind = bookingKindOf(booking);
  if (isStaffPaymentKind(kind)) {
    const kindLabel = labels[kind] || (kind === 'employee_advance' ? labels.advance : kind);
    return `${kindLabel} · ${booking.employee_name || labels.employee}`;
  }
  if (booking.item) return `${booking.category} · ${booking.item}`;
  return booking.category || typeLabel(booking.type);
}
