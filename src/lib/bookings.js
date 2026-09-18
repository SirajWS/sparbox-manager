import { isPositiveAmount, roundAmount } from './money.js';

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

export function isFormComplete(form) {
  return isPositiveAmount(form.amount)
    && (form.type === 'in' || form.type === 'out')
    && Boolean(form.category)
    && Boolean(form.date)
    && Boolean(PAID_BY[form.paidBy]);
}

export function bookingFingerprint(form) {
  return [
    form.type,
    roundAmount(form.amount),
    form.category,
    form.date,
    form.paidBy,
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
