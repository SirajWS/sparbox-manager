import { describe, expect, it } from 'vitest';
import { buildStaffStatementModel, buildStatementModel, renderStaffPdf, renderStatementPdf, statementDescription, wrapText } from './pdf.js';

const ledger = [
  {
    id: 'in1',
    type: 'in',
    amount: 1000,
    paid_by: 'siraj',
    category: 'Investition / Einlage',
    date: '2026-01-05',
    booking_kind: 'normal',
    note: null
  },
  {
    id: 'p1',
    type: 'out',
    amount: 38,
    paid_by: 'chedi',
    category: 'Ware / Einkauf',
    item: 'Vanille-Sticks',
    note: '4 Stück × 9,500 TND',
    date: '2026-09-17',
    booking_kind: 'normal'
  },
  {
    id: 's1',
    type: 'out',
    amount: 800,
    paid_by: 'chedi',
    category: 'Personal',
    booking_kind: 'salary',
    employee_name: 'Ahmed',
    note: 'Gehalt – Ahmed',
    date: '2026-03-10'
  }
];

describe('statement PDF model', () => {
  it('keeps statement totals from bookings without a second source', () => {
    const model = buildStatementModel(ledger, 'de');
    expect(model.title).toBe('Kontoauszug');
    expect(model.totals.totalIn).toBe(1000);
    expect(model.totals.totalOut).toBe(838);
    expect(model.totals.paidByChedi).toBe(838);
    expect(model.rows).toHaveLength(3);
    const purchase = model.rows.find((row) => row.amount.startsWith('-38'));
    expect(purchase.description).toEqual(['Vanille-Sticks', '4 Stück × 9,500 TND']);
    expect(purchase.paidBy).toBe('Chedi');
  });

  it('translates statement labels for EN and FR', () => {
    expect(buildStatementModel(ledger, 'en').title).toBe('Statement');
    expect(buildStatementModel(ledger, 'fr').title).toBe('Relevé de compte');
    expect(statementDescription(ledger[1], 'fr')[0]).toBe('Bâtonnets vanille');
  });
});

describe('staff PDF model', () => {
  it('aggregates selected employee and year', () => {
    const model = buildStaffStatementModel(ledger, { employeeName: 'Ahmed', year: 2026 }, 'de');
    expect(model.title).toBe('Personal-Zahlungsnachweis');
    expect(model.employeeName).toBe('Ahmed');
    expect(model.period).toBe('2026');
    expect(model.empty).toBe(false);
    expect(model.totals.salary).toBe(800);
    expect(model.totals.total).toBe(800);
    expect(model.rows[0].kind).toBe('Gehalt');
  });

  it('shows a clean empty state instead of a broken table', () => {
    const model = buildStaffStatementModel(ledger, { employeeName: 'Ahmed', year: 2024 }, 'fr');
    expect(model.empty).toBe(true);
    expect(model.rows).toEqual([]);
    expect(model.emptyMessage).toBe('Aucun paiement du personnel sur cette période.');
    expect(model.totals.total).toBe(0);
  });

  it('can limit the PDF period to one month', () => {
    const march = buildStaffStatementModel(ledger, { employeeName: 'Ahmed', year: 2026, month: 3 }, 'de');
    expect(march.period).toBe('März 2026');
    expect(march.rows).toHaveLength(1);
    const april = buildStaffStatementModel(ledger, { employeeName: 'Ahmed', year: 2026, month: 4 }, 'de');
    expect(april.empty).toBe(true);
  });
});

describe('PDF wrapping', () => {
  it('wraps long notes instead of truncating them to one line', () => {
    const lines = wrapText('Vanille-Sticks für die Produktion und Extra-Notiz die länger ist', 80, 9);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toContain('Vanille-Sticks');
  });
});

describe('PDF binary', () => {
  it('writes a valid A4 statement with table objects', () => {
    const pdf = renderStatementPdf(ledger, 'de');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('%%EOF');
    expect(pdf).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(pdf).toContain('MixMax Manager');
    expect(pdf).toContain('/Type /Page');
    expect(pdf).toContain('/Encoding /WinAnsiEncoding');
  });

  it('writes a valid empty staff statement instead of a broken document', () => {
    const pdf = renderStaffPdf(ledger, { employeeName: 'Ahmed', year: 2024 }, 'fr');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('%%EOF');
    expect(pdf).toContain('/Type /Page');
  });
});
