import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  balanceTrend,
  bookingSignedAmount,
  dailyEndBalances,
  openingBalanceBefore
} from './balanceChart.js';
import { MASKED_BALANCE } from './privacy.js';
import { renderBalanceChartHtml } from './balanceChart.js';
import { formatTnd } from './money.js';
import { formatDate } from './format.js';

const rows = [
  { id: 'a', type: 'in', amount: 100, date: '2026-09-15' },
  { id: 'b', type: 'out', amount: 20, date: '2026-09-15' },
  { id: 'c', type: 'out', amount: 73, date: '2026-09-16' },
  { id: 'd', type: 'in', amount: 10, date: '2026-09-18' }
];

describe('balance trend', () => {
  it('uses signed income and expense amounts', () => {
    expect(bookingSignedAmount({ type: 'in', amount: 80 })).toBe(80);
    expect(bookingSignedAmount({ type: 'out', amount: 73 })).toBe(-73);
  });

  it('uses the end-of-day balance when several bookings share a date', () => {
    const { byDate } = dailyEndBalances(rows);
    expect(byDate.get('2026-09-15')).toBe(80);
    expect(byDate.get('2026-09-16')).toBe(7);
    expect(byDate.get('2026-09-18')).toBe(17);
  });

  it('carries the opening balance into a 7-day window', () => {
    const points = balanceTrend(rows, 7, '2026-09-22');
    expect(points).toHaveLength(7);
    expect(points[0].date).toBe('2026-09-16');
    expect(openingBalanceBefore(rows, '2026-09-16')).toBe(80);
    expect(points[0].balance).toBe(7);
    expect(points.at(-1)).toEqual({ date: '2026-09-22', balance: 17 });
  });

  it('plots the full history for the all-time range', () => {
    const points = balanceTrend(rows, 'all', '2026-09-18');
    expect(points[0]).toEqual({ date: '2026-09-15', balance: 80 });
    expect(points.at(-1)).toEqual({ date: '2026-09-18', balance: 17 });
    expect(addDaysISO('2026-09-15', 1)).toBe('2026-09-16');
  });

  it('hides concrete amounts in the privacy tooltip text', () => {
    const html = renderBalanceChartHtml(
      [{ date: '2026-09-22', balance: 445.63 }],
      'de',
      { hidden: true, formatTnd, formatDate }
    );
    expect(html).toContain('Saldoentwicklung');
    expect(html).not.toContain('445');
    expect(MASKED_BALANCE).toContain('TND');
  });
});
