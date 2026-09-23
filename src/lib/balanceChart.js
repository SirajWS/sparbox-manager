import { sortOldestFirst } from './bookings.js';
import { esc } from './format.js';
import { t } from './i18n.js';
import { MASKED_BALANCE } from './privacy.js';

export const TREND_RANGES = [7, 30, 90, 'all'];

export function addDaysISO(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + Number(days));
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function bookingSignedAmount(booking) {
  const amount = Number(booking?.amount) || 0;
  if (booking?.type === 'in') return amount;
  if (booking?.type === 'out') return -amount;
  return 0;
}

export function dailyEndBalances(bookings) {
  const byDate = new Map();
  let stand = 0;
  for (const booking of sortOldestFirst(bookings || [])) {
    stand += bookingSignedAmount(booking);
    const date = String(booking.date || '').slice(0, 10);
    if (date) byDate.set(date, stand);
  }
  return { byDate, final: stand };
}

export function openingBalanceBefore(bookings, startDate) {
  let stand = 0;
  for (const booking of sortOldestFirst(bookings || [])) {
    const date = String(booking.date || '').slice(0, 10);
    if (!date || date >= startDate) break;
    stand += bookingSignedAmount(booking);
  }
  return stand;
}

export function fillDailySeries(byDate, start, end, opening) {
  const points = [];
  if (!start || !end || start > end) return points;
  let current = opening;
  for (let day = start; day <= end; day = addDaysISO(day, 1)) {
    if (byDate.has(day)) current = byDate.get(day);
    points.push({ date: day, balance: current });
  }
  return points;
}

export function balanceTrend(bookings, range = 30, nowISO) {
  const rows = bookings || [];
  if (!rows.length) return [];
  const { byDate } = dailyEndBalances(rows);
  const dates = [...byDate.keys()].sort();
  if (!dates.length) return [];
  const end = nowISO;
  const first = dates[0];
  const start = range === 'all'
    ? first
    : addDaysISO(end, -(Number(range) - 1));
  return fillDailySeries(byDate, start, end, openingBalanceBefore(rows, start));
}

export function chartBounds(points) {
  const values = (points || []).map((point) => Number(point.balance) || 0);
  if (!values.length) return { min: 0, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) > 1 ? Math.abs(min) * 0.08 : 1;
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

function amountLabel(value, hidden, formatTnd) {
  return hidden ? MASKED_BALANCE : formatTnd(value);
}

export function renderBalanceChartHtml(points, lang, { hidden = false, formatTnd, formatAxis, formatDate } = {}) {
  if (!points.length) {
    return `<div class="empty">${esc(t(lang, 'no_bookings'))}</div>`;
  }

  const w = 640;
  const h = 220;
  const pad = { l: hidden ? 18 : 58, r: 18, t: 18, b: 30 };
  const { min, max } = chartBounds(points);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const xAt = (index) => pad.l + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const yAt = (value) => pad.t + ((max - value) / (max - min || 1)) * innerH;
  const path = points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(2)} ${yAt(point.balance).toFixed(2)}`
  )).join(' ');

  const ticks = [max, (min + max) / 2, min];
  const grid = ticks.map((value) => {
    const y = yAt(value);
    const label = hidden ? '' : `<text x="${pad.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${esc((formatAxis || formatTnd)(value))}</text>`;
    return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}" />${label}`;
  }).join('');

  const labelIdx = points.length === 1
    ? [0]
    : points.length === 2
      ? [0, 1]
      : [0, Math.round((points.length - 1) / 2), points.length - 1];
  const xLabels = [...new Set(labelIdx)].map((index) => (
    `<text x="${xAt(index).toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(formatDate(points[index].date, lang))}</text>`
  )).join('');

  const last = points[points.length - 1];
  const lastX = xAt(points.length - 1);
  const lastY = yAt(last.balance);

  return `<div class="trend-chart">
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(t(lang, 'balance_trend'))}">
      <g class="trend-grid">${grid}</g>
      <path class="trend-line" d="${path}" />
      <circle class="trend-dot" cx="${lastX.toFixed(2)}" cy="${lastY.toFixed(2)}" r="4.5" />
      <g class="trend-x">${xLabels}</g>
    </svg>
    <div class="trend-tooltip" hidden></div>
  </div>`;
}

export function mountBalanceChart(el, points, lang, options = {}) {
  if (!el) return;
  el.innerHTML = renderBalanceChartHtml(points, lang, options);
  const svg = el.querySelector('svg');
  const tip = el.querySelector('.trend-tooltip');
  if (!svg || !tip || !points.length) return;

  const w = 640;
  const padL = options.hidden ? 18 : 58;
  const padR = 18;
  const innerW = w - padL - padR;

  const show = (index, clientX, clientY) => {
    const point = points[index];
    if (!point) return;
    tip.hidden = false;
    tip.innerHTML = `<strong>${esc(options.formatDate(point.date, lang))}</strong><span>${esc(amountLabel(point.balance, options.hidden, options.formatTnd))}</span>`;
    const host = el.getBoundingClientRect();
    const left = Math.min(Math.max(10, clientX - host.left - 70), host.width - 150);
    const top = Math.min(Math.max(8, clientY - host.top - 58), host.height - 64);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  const indexFromEvent = (event) => {
    const rect = svg.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const vbX = ((clientX - rect.left) / rect.width) * w;
    const ratio = points.length === 1 ? 0 : (vbX - padL) / innerW;
    return Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
  };

  const onMove = (event) => {
    if (event.touches) event.preventDefault();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    show(indexFromEvent(event), clientX, clientY);
  };

  svg.addEventListener('mousemove', onMove);
  svg.addEventListener('touchstart', onMove, { passive: false });
  svg.addEventListener('touchmove', onMove, { passive: false });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; });
  svg.addEventListener('touchend', () => { tip.hidden = true; });
}
