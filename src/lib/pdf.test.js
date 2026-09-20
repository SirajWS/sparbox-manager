import { describe, expect, it } from 'vitest';
import {
  buildStaffStatementModel,
  buildStatementModel,
  renderStaffPdf,
  renderStatementPdf,
  staffPdfFilename,
  statementDescription,
  statementPdfFilename,
  wrapText
} from './pdf.js';

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
  it('uses updated booking amounts after an edit', () => {
    const edited = ledger.map((row) => (row.id === 'p1' ? { ...row, amount: 42 } : row));
    const model = buildStatementModel(edited, 'de');
    expect(model.totals.totalOut).toBe(842);
    expect(model.rows.some((row) => row.amount.includes('42'))).toBe(true);
  });

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

  it('translates staff booking kinds without changing stored values', () => {
    const rows = [
      { ...ledger[2], booking_kind: 'salary' },
      {
        id: 'a1',
        type: 'out',
        amount: 1,
        paid_by: 'siraj',
        category: 'Personal',
        booking_kind: 'employee_advance',
        employee_name: 'Ahmed',
        date: '2026-03-11',
        note: ''
      },
      {
        id: 't1',
        type: 'out',
        amount: 2,
        paid_by: 'siraj',
        category: 'Personal',
        booking_kind: 'tip',
        employee_name: 'Ahmed',
        date: '2026-03-12',
        note: ''
      },
      {
        id: 'o1',
        type: 'out',
        amount: 3,
        paid_by: 'siraj',
        category: 'Personal',
        booking_kind: 'other_staff',
        employee_name: 'Ahmed',
        date: '2026-03-13',
        note: ''
      }
    ];
    expect(buildStaffStatementModel(rows, { employeeName: 'Ahmed', year: 2026 }, 'de').rows.map((row) => row.kind))
      .toEqual(['Gehalt', 'Vorschuss', 'Trinkgeld', 'Sonstiges']);
    expect(buildStaffStatementModel(rows, { employeeName: 'Ahmed', year: 2026 }, 'en').rows.map((row) => row.kind))
      .toEqual(['Salary', 'Advance', 'Tip', 'Other']);
    expect(buildStaffStatementModel(rows, { employeeName: 'Ahmed', year: 2026 }, 'fr').rows.map((row) => row.kind))
      .toEqual(['Salaire', 'Avance', 'Pourboire', 'Divers']);
  });

  it('keeps a professional subtitle without inventing payroll fields', () => {
    const model = buildStaffStatementModel(ledger, { employeeName: 'Ahmed', year: 2026 }, 'de');
    expect(model.subtitle).toBe('Interne Zahlungsübersicht');
    expect(model.hasSalary).toBe(true);
    expect(buildStaffStatementModel(ledger, { employeeName: 'Ahmed', year: 2026 }, 'en').subtitle)
      .toBe('Internal payment summary');
    expect(buildStaffStatementModel(ledger, { employeeName: 'Ahmed', year: 2026 }, 'fr').subtitle)
      .toBe('Récapitulatif interne des paiements');
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

  it('embeds a MixMax logo XObject with alpha mask when raster data is provided', () => {
    const logo = {
      width: 2,
      height: 2,
      rgb: Uint8Array.from([200, 20, 20, 200, 20, 20, 20, 20, 20, 20, 20, 20]),
      alpha: Uint8Array.from([255, 255, 0, 0])
    };
    const statement = renderStatementPdf(ledger, 'de', logo);
    expect(statement).toContain('/Subtype /Image');
    expect(statement).toContain('/Im1');
    expect(statement).toContain('/SMask 5 0 R');
    expect(statement).toContain('MixMax Manager');
    const staff = renderStaffPdf(ledger, { employeeName: 'Ahmed', year: 2026 }, 'fr', logo);
    expect(staff).toContain('/Im1');
    expect(staff).toContain('MixMax Manager');
  });

  it('writes a valid empty staff statement instead of a broken document', () => {
    const pdf = renderStaffPdf(ledger, { employeeName: 'Ahmed', year: 2024 }, 'fr');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('%%EOF');
    expect(pdf).toContain('/Type /Page');
  });

  it('closes the statement with the current balance and repeats chrome on extra pages', () => {
    const pdf = renderStatementPdf(ledger, 'de');
    expect(pdf).toContain('Aktueller Stand');
    expect(pdf).toContain('Kontoauszug');
    expect(pdf).toContain('Seite 1 / 1');
    expect(pdf).not.toContain('{total}');

    const many = Array.from({ length: 45 }, (_, i) => ({
      ...ledger[1],
      id: `r${i}`,
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`
    }));
    const longPdf = renderStatementPdf(many, 'de');
    const pageCount = (longPdf.match(/\/Type \/Page /g) || []).length;
    expect(pageCount).toBeGreaterThan(1);
    expect((longPdf.match(/MixMax Manager/g) || []).length).toBe(pageCount);
    expect((longPdf.match(/Datum/g) || []).length).toBe(pageCount);
    expect(longPdf).toContain(`Seite 1 / ${pageCount}`);
    expect(longPdf).toContain(`Seite ${pageCount} / ${pageCount}`);
  });

  it('renders a staff payment statement with summary, note and signatures', () => {
    const pdf = renderStaffPdf(ledger, { employeeName: 'Ahmed', year: 2026 }, 'de');
    expect(pdf).toContain('Personal-Zahlungsnachweis');
    expect(pdf).toContain('Interne Zahlungs');
    expect(pdf).toContain('Zusammenfassung');
    expect(pdf).toContain('Zahlungsdetails');
    expect(pdf).toContain('Gesamtsumme');
    expect(pdf).toContain('Hinweis');
    expect(pdf).toContain('Mitarbeiter');
    expect(pdf).toContain('Verwaltung');
    expect(pdf).toContain('Gehalt');
    expect(pdf).not.toMatch(/Bruttogehalt|Nettogehalt|Steuerklasse|Sozialversicherung|Krankenversicherung|Rentenversicherung/);

    const en = renderStaffPdf(ledger, { employeeName: 'Ahmed', year: 2026 }, 'en');
    expect(en).toContain('Staff Payment Statement');
    expect(en).toContain('Payment details');
    expect(en).toContain('Salary summary');
    expect(en).toContain('Employee');
    expect(en).toContain('Management');

    const fr = renderStaffPdf(ledger, { employeeName: 'Ahmed', year: 2026 }, 'fr');
    expect(fr).toContain('Relev');
    expect(fr).toContain('Employ');
    expect(fr).toContain('Gestion');
  });

  it('embeds the MixMax logo at the larger PDF header size', () => {
    const logo = {
      width: 2,
      height: 2,
      rgb: Uint8Array.from([200, 20, 20, 200, 20, 20, 20, 20, 20, 20, 20, 20]),
      alpha: Uint8Array.from([255, 255, 0, 0])
    };
    const pdf = renderStatementPdf(ledger, 'de', logo);
    expect(pdf).toContain('46 0 0 46');
    expect(pdf).toContain('/Im1 Do');
  });

  it('builds sanitized PDF filenames without a year suffix', () => {
    expect(statementPdfFilename('de', '2026-09-19')).toBe('MixMax-Kontoauszug-2026-09-19.pdf');
    expect(staffPdfFilename({ employeeName: 'issa', year: 2026 }, 'de'))
      .toBe('MixMax-Personal-Zahlungsnachweis-issa-2026.pdf');
    expect(staffPdfFilename({ employeeName: 'issa', year: 2026, month: 9 }, 'de'))
      .toBe('MixMax-Personal-Zahlungsnachweis-issa-2026-09.pdf');
    expect(staffPdfFilename({ employeeName: 'issa', year: 2026 }, 'en'))
      .toBe('MixMax-Staff-Payment-Statement-issa-2026.pdf');
    expect(staffPdfFilename({ employeeName: 'issa', year: 2026 }, 'de')).not.toContain('-year');
  });
});
