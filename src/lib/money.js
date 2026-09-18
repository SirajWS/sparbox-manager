const TND = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3
});

export function roundAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 1000) / 1000;
}

export function parseAmount(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return roundAmount(s);
}

export function formatTndNumber(value) {
  const n = roundAmount(value);
  if (!Number.isFinite(n)) return '–';
  return TND.format(n);
}

export function formatTnd(value) {
  return formatTndNumber(value) + ' TND';
}

export function isPositiveAmount(value) {
  const n = roundAmount(value);
  return Number.isFinite(n) && n > 0;
}
