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

export function bookingKindOf(bookingOrForm) {
  const kind = bookingOrForm?.bookingKind || bookingOrForm?.booking_kind;
  return kind === 'employee_advance' ? 'employee_advance' : 'normal';
}

export function isEmployeeAdvance(booking) {
  return bookingKindOf(booking) === 'employee_advance';
}

export function isFormComplete(form) {
  if (bookingKindOf(form) === 'employee_advance') {
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

export function advanceNote(employeeName, note) {
  const custom = String(note || '').trim();
  const label = `Vorschuss – ${String(employeeName || '').trim()}`;
  return custom ? `${label}: ${custom}` : label;
}

export function toAdvancePayload(form) {
  const employeeName = String(form.employeeName || '').trim();
  return {
    type: 'out',
    amount: roundAmount(form.amount),
    currency: 'TND',
    category: PERSONNEL_CATEGORY,
    item: null,
    note: advanceNote(employeeName, form.note),
    date: form.date,
    paid_by: form.paidBy,
    booking_kind: 'employee_advance',
    employee_name: employeeName
  };
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
  if (isEmployeeAdvance(booking)) {
    return `${labels.advance} · ${booking.employee_name || labels.employee}`;
  }
  if (booking.item) return `${booking.category} · ${booking.item}`;
  return booking.category || typeLabel(booking.type);
}
