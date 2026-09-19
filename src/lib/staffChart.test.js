import { describe, expect, it } from 'vitest';
import { staffYearMonths } from './bookings.js';
import { chartScaleMax, renderStaffChartHtml, stackedPercents } from './staffChart.js';
import { formatTnd } from './money.js';

describe('staff chart', () => {
  const months = staffYearMonths([
    { id: 's1', type: 'out', amount: 800, booking_kind: 'salary', employee_name: 'Ahmed', date: '2026-03-10' },
    { id: 'a1', type: 'out', amount: 200, booking_kind: 'employee_advance', employee_name: 'Ahmed', date: '2026-03-12' }
  ], 'Ahmed', 2026);

  it('builds 12 stacked months without fake values', () => {
    expect(months).toHaveLength(12);
    expect(months.every((row) => row.total === 0 || row.month === 3)).toBe(true);
    expect(chartScaleMax(months)).toBe(1000);
    const percents = stackedPercents(months[2], 1000);
    expect(percents.salary).toBe(80);
    expect(percents.employee_advance).toBe(20);
    expect(stackedPercents(months[0], 1000).salary).toBe(0);
  });

  it('renders legend and tooltips in the current language', () => {
    const html = renderStaffChartHtml(months, 'fr', formatTnd);
    expect(html).toContain('Salaire');
    expect(html).toContain('Avance');
    expect(html).toContain('Pourboire');
    expect(html).toContain('Divers');
    expect(html).toContain('staff-col');
    expect(html.match(/staff-col/g).length).toBeGreaterThanOrEqual(12);
    expect(html).not.toContain('999,000');
  });
});
