import { formatTnd, formatTndNumber } from './money.js';
import {
  bookingKindOf,
  filterStaffPayments,
  isStaffPayment,
  sortOldestFirst,
  staffKindTotals,
  summarize
} from './bookings.js';
import { formatDate, todayISO } from './format.js';
import {
  categoryLabel,
  itemLabel,
  monthLongLabel,
  paidByLabelI18n,
  staffKindLabel,
  t,
  typeLabelI18n
} from './i18n.js';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const NAVY = [0.063, 0.133, 0.22];
const MUTED = [0.396, 0.443, 0.522];
const LINE = [0.867, 0.894, 0.922];
const SOFT = [0.949, 0.961, 0.969];
const RED = [0.784, 0.29, 0.29];
const GREEN = [0.122, 0.561, 0.38];

const WINANSI = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F,
  ' ': 0x20, '¡': 0xA1, '¢': 0xA2, '£': 0xA3, '¤': 0xA4, '¥': 0xA5, '¦': 0xA6,
  '§': 0xA7, '¨': 0xA8, '©': 0xA9, 'ª': 0xAA, '«': 0xAB, '¬': 0xAC, '®': 0xAE,
  '¯': 0xAF, '°': 0xB0, '±': 0xB1, '²': 0xB2, '³': 0xB3, '´': 0xB4, 'µ': 0xB5,
  '¶': 0xB6, '·': 0xB7, '¸': 0xB8, '¹': 0xB9, 'º': 0xBA, '»': 0xBB, '¼': 0xBC,
  '½': 0xBD, '¾': 0xBE, '¿': 0xBF, 'À': 0xC0, 'Á': 0xC1, 'Â': 0xC2, 'Ã': 0xC3,
  'Ä': 0xC4, 'Å': 0xC5, 'Æ': 0xC6, 'Ç': 0xC7, 'È': 0xC8, 'É': 0xC9, 'Ê': 0xCA,
  'Ë': 0xCB, 'Ì': 0xCC, 'Í': 0xCD, 'Î': 0xCE, 'Ï': 0xCF, 'Ð': 0xD0, 'Ñ': 0xD1,
  'Ò': 0xD2, 'Ó': 0xD3, 'Ô': 0xD4, 'Õ': 0xD5, 'Ö': 0xD6, '×': 0xD7, 'Ø': 0xD8,
  'Ù': 0xD9, 'Ú': 0xDA, 'Û': 0xDB, 'Ü': 0xDC, 'Ý': 0xDD, 'Þ': 0xDE, 'ß': 0xDF,
  'à': 0xE0, 'á': 0xE1, 'â': 0xE2, 'ã': 0xE3, 'ä': 0xE4, 'å': 0xE5, 'æ': 0xE6,
  'ç': 0xE7, 'è': 0xE8, 'é': 0xE9, 'ê': 0xEA, 'ë': 0xEB, 'ì': 0xEC, 'í': 0xED,
  'î': 0xEE, 'ï': 0xEF, 'ð': 0xF0, 'ñ': 0xF1, 'ò': 0xF2, 'ó': 0xF3, 'ô': 0xF4,
  'õ': 0xF5, 'ö': 0xF6, '÷': 0xF7, 'ø': 0xF8, 'ù': 0xF9, 'ú': 0xFA, 'û': 0xFB,
  'ü': 0xFC, 'ý': 0xFD, 'þ': 0xFE, 'ÿ': 0xFF
};

function pdfString(value) {
  let out = '';
  for (const char of String(value == null ? '' : value)) {
    const code = char.codePointAt(0);
    if (char === '\\' || char === '(' || char === ')') {
      out += `\\${char}`;
    } else if (code >= 0x20 && code <= 0x7E) {
      out += char;
    } else if (WINANSI[char] != null) {
      out += `\\${WINANSI[char].toString(8).padStart(3, '0')}`;
    } else if (char === '\u2013' || char === '\u2014') {
      out += '-';
    } else if (char === '\u00A0') {
      out += ' ';
    } else {
      out += '?';
    }
  }
  return out;
}

function stringWidth(text, size) {
  let width = 0;
  for (const char of String(text || '')) {
    if ('ilI.,;:\'|! '.includes(char)) width += 278;
    else if ('mwMW@%'.includes(char)) width += 833;
    else if (char === char.toUpperCase() && /[A-ZÄÖÜ]/.test(char)) width += 667;
    else width += 556;
  }
  return (width * size) / 1000;
}

export function wrapText(text, maxWidth, fontSize = 9) {
  const raw = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!raw) return [''];
  const words = raw.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (stringWidth(next, fontSize) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function rgb(color) {
  return `${color[0]} ${color[1]} ${color[2]}`;
}

function createPage() {
  return [];
}

function addFill(ops, x, y, w, h, color) {
  ops.push(`${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
}

function addStroke(ops, x1, y1, x2, y2, color = LINE, width = 0.6) {
  ops.push(`q ${width} w ${rgb(color)} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
}

function addText(ops, x, y, text, { size = 10, color = [0.078, 0.125, 0.2], align = 'left', maxWidth } = {}) {
  let value = String(text == null ? '' : text);
  if (maxWidth) {
    while (value.length > 1 && stringWidth(value, size) > maxWidth) {
      value = value.slice(0, -1);
    }
  }
  let drawX = x;
  if (align === 'right') drawX = x - stringWidth(value, size);
  if (align === 'center') drawX = x - stringWidth(value, size) / 2;
  ops.push(`BT /F1 ${size} Tf ${rgb(color)} rg 1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm (${pdfString(value)}) Tj ET`);
}

function buildPdf(pages) {
  const contentObjs = pages.map((ops) => {
    const stream = ops.join('\n');
    return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  const pageCount = pages.length;
  const kids = pages.map((_, i) => `${4 + i} 0 R`).join(' ');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ...pages.map((_, i) => (
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${4 + pageCount + i} 0 R >>`
    )),
    ...contentObjs
  ];

  let pdf = '%PDF-1.4\n';
  const offs = [0];
  objs.forEach((obj, i) => {
    offs.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offs.slice(1).forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function downloadPdf(content, name) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addPageChrome(ops, lang, pageNo) {
  addFill(ops, 0, PAGE_H - 28, PAGE_W, 28, NAVY);
  addText(ops, MARGIN, PAGE_H - 18, 'MixMax Manager', { size: 10, color: [1, 1, 1] });
  addText(ops, PAGE_W - MARGIN, 28, t(lang, 'page', { current: String(pageNo), total: '{total}' }), {
    size: 8,
    color: MUTED,
    align: 'right'
  });
}

function finalizePageNumbers(pages, lang) {
  const total = String(pages.length);
  const needle = t(lang, 'page', { current: '1', total: '{total}' }).replace('1', '');
  pages.forEach((ops) => {
    for (let i = 0; i < ops.length; i += 1) {
      if (ops[i].includes('{total}') || (needle && ops[i].includes('{total}'))) {
        ops[i] = ops[i].replace('{total}', total);
      }
    }
  });
}

function userNote(booking) {
  const note = String(booking.note || '').trim();
  if (!note) return '';
  if (isStaffPayment(booking)) {
    return note.replace(/^(Gehalt|Vorschuss|Trinkgeld|Sonstiges|Personal)\s+[–-]\s+[^:]+:\s*/u, '').trim();
  }
  return note;
}

export function statementDescription(booking, lang) {
  const lines = [];
  if (booking.item) lines.push(itemLabel(lang, booking.item));
  else if (isStaffPayment(booking)) {
    lines.push(`${staffKindLabel(lang, bookingKindOf(booking))} · ${booking.employee_name || t(lang, 'employee')}`);
  }
  const note = userNote(booking);
  if (note && note !== lines[0]) lines.push(note);
  return lines;
}

export function buildStatementModel(bookings, lang = 'de') {
  const totals = summarize(bookings);
  return {
    title: t(lang, 'statement_title'),
    created: formatDate(todayISO(), lang),
    totals,
    rows: sortOldestFirst(bookings).map((booking) => ({
      date: formatDate(booking.date, lang),
      type: typeLabelI18n(lang, booking.type),
      category: categoryLabel(lang, booking.category),
      description: statementDescription(booking, lang),
      paidBy: paidByLabelI18n(lang, booking.paid_by),
      amount: `${booking.type === 'in' ? '+' : '-'}${formatTndNumber(booking.amount)} TND`,
      out: booking.type === 'out'
    }))
  };
}

export function staffPeriodLabel(lang, year, month) {
  if (month) return `${monthLongLabel(lang, month)} ${year}`;
  return String(year);
}

export function buildStaffStatementModel(bookings, { employeeName, year, month } = {}, lang = 'de') {
  const rows = sortOldestFirst(filterStaffPayments(bookings, { employeeName, year, month }));
  const totals = staffKindTotals(rows);
  return {
    title: t(lang, 'staff_pdf_title'),
    employeeName: employeeName || t(lang, 'employee'),
    period: staffPeriodLabel(lang, year, month),
    created: formatDate(todayISO(), lang),
    totals,
    empty: rows.length === 0,
    emptyMessage: t(lang, 'no_staff_in_period'),
    rows: rows.map((booking) => ({
      date: formatDate(booking.date, lang),
      kind: staffKindLabel(lang, bookingKindOf(booking)),
      paidBy: paidByLabelI18n(lang, booking.paid_by),
      note: userNote(booking) || '–',
      amount: formatTnd(booking.amount)
    }))
  };
}

function drawSummaryBoxes(ops, items, y) {
  const gap = 8;
  const boxW = (CONTENT_W - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const x = MARGIN + i * (boxW + gap);
    addFill(ops, x, y - 36, boxW, 42, SOFT);
    addText(ops, x + 8, y - 6, item.label, { size: 7.5, color: MUTED, maxWidth: boxW - 16 });
    addText(ops, x + 8, y - 24, item.value, { size: 10, color: item.color || NAVY, maxWidth: boxW - 16 });
  });
  return y - 52;
}

function drawTableHeader(ops, columns, y) {
  addFill(ops, MARGIN, y - 16, CONTENT_W, 20, NAVY);
  let x = MARGIN + 6;
  columns.forEach((col) => {
    addText(ops, col.align === 'right' ? x + col.width - 6 : x, y - 10, col.label, {
      size: 7.5,
      color: [1, 1, 1],
      align: col.align === 'right' ? 'right' : 'left',
      maxWidth: col.width - 10
    });
    x += col.width;
  });
  return y - 22;
}

function measureRow(columns, values, fontSize = 8.5) {
  let lines = 1;
  columns.forEach((col, i) => {
    const cell = values[i];
    const parts = Array.isArray(cell) ? cell : wrapText(cell, col.width - 12, fontSize);
    lines = Math.max(lines, parts.length);
  });
  return Math.max(22, 10 + lines * 11);
}

function drawRow(ops, columns, values, y, height, { zebra = false, amountOut = false } = {}) {
  if (zebra) addFill(ops, MARGIN, y - height + 2, CONTENT_W, height, [0.976, 0.98, 0.984]);
  addStroke(ops, MARGIN, y - height + 2, MARGIN + CONTENT_W, y - height + 2, LINE, 0.4);
  let x = MARGIN + 6;
  columns.forEach((col, i) => {
    const cell = values[i];
    const parts = Array.isArray(cell) ? cell.flatMap((line) => wrapText(line, col.width - 12, 8.5)) : wrapText(cell, col.width - 12, 8.5);
    parts.forEach((line, lineIndex) => {
      const color = col.amount ? (amountOut ? RED : GREEN) : [0.078, 0.125, 0.2];
      addText(ops, col.align === 'right' ? x + col.width - 12 : x, y - 12 - lineIndex * 11, line, {
        size: 8.5,
        color,
        align: col.align === 'right' ? 'right' : 'left',
        maxWidth: col.width - 12
      });
    });
    x += col.width;
  });
}

function newDocumentPage(pages, lang) {
  const ops = createPage();
  pages.push(ops);
  addPageChrome(ops, lang, pages.length);
  return ops;
}

export function renderStatementPdf(bookings, lang = 'de') {
  const model = buildStatementModel(bookings, lang);
  const columns = [
    { key: 'date', label: t(lang, 'col_date'), width: 58 },
    { key: 'type', label: t(lang, 'col_type'), width: 62 },
    { key: 'category', label: t(lang, 'col_category'), width: 78 },
    { key: 'description', label: t(lang, 'col_item_desc'), width: 155 },
    { key: 'paidBy', label: t(lang, 'col_paid_by'), width: 58 },
    { key: 'amount', label: t(lang, 'col_amount'), width: 88, align: 'right', amount: true }
  ];
  const pages = [];
  let ops = newDocumentPage(pages, lang);
  let y = PAGE_H - 56;

  addText(ops, MARGIN, y, model.title, { size: 18, color: NAVY });
  y -= 18;
  addText(ops, MARGIN, y, `${t(lang, 'created_on')}: ${model.created}`, { size: 9, color: MUTED });
  y -= 22;

  y = drawSummaryBoxes(ops, [
    { label: t(lang, 'current_balance'), value: formatTnd(model.totals.balance) },
    { label: t(lang, 'income'), value: formatTnd(model.totals.totalIn), color: GREEN },
    { label: t(lang, 'expenses'), value: formatTnd(model.totals.totalOut), color: RED }
  ], y);
  y = drawSummaryBoxes(ops, [
    { label: t(lang, 'expenses_siraj'), value: formatTnd(model.totals.paidBySiraj) },
    { label: t(lang, 'expenses_chedi'), value: formatTnd(model.totals.paidByChedi) }
  ], y);
  y -= 6;
  y = drawTableHeader(ops, columns, y);

  if (!model.rows.length) {
    addText(ops, MARGIN, y - 16, t(lang, 'no_bookings'), { size: 10, color: MUTED });
  }

  model.rows.forEach((row, index) => {
    const values = [row.date, row.type, row.category, row.description, row.paidBy, row.amount];
    const height = measureRow(columns, values);
    if (y - height < 48) {
      ops = newDocumentPage(pages, lang);
      y = PAGE_H - 56;
      y = drawTableHeader(ops, columns, y);
    }
    drawRow(ops, columns, values, y, height, { zebra: index % 2 === 1, amountOut: row.out });
    y -= height;
  });

  finalizePageNumbers(pages, lang);
  return buildPdf(pages);
}

export function renderStaffPdf(bookings, filter, lang = 'de') {
  const model = buildStaffStatementModel(bookings, filter, lang);
  const columns = [
    { key: 'date', label: t(lang, 'col_date'), width: 62 },
    { key: 'kind', label: t(lang, 'col_kind'), width: 88 },
    { key: 'paidBy', label: t(lang, 'col_paid_by'), width: 70 },
    { key: 'note', label: t(lang, 'col_note'), width: 191 },
    { key: 'amount', label: t(lang, 'col_amount'), width: 88, align: 'right', amount: true }
  ];
  const pages = [];
  let ops = newDocumentPage(pages, lang);
  let y = PAGE_H - 56;

  addText(ops, MARGIN, y, model.title, { size: 18, color: NAVY });
  y -= 18;
  addText(ops, MARGIN, y, `${t(lang, 'employee')}: ${model.employeeName}`, { size: 10, color: NAVY });
  y -= 14;
  addText(ops, MARGIN, y, `${t(lang, 'period')}: ${model.period}`, { size: 10, color: NAVY });
  y -= 14;
  addText(ops, MARGIN, y, `${t(lang, 'created_on')}: ${model.created}`, { size: 9, color: MUTED });
  y -= 24;

  addText(ops, MARGIN, y, t(lang, 'staff_summary'), { size: 11, color: NAVY });
  y -= 16;
  y = drawSummaryBoxes(ops, [
    { label: t(lang, 'kind_salary'), value: formatTnd(model.totals.salary) },
    { label: t(lang, 'kind_advance'), value: formatTnd(model.totals.employee_advance) },
    { label: t(lang, 'kind_tip'), value: formatTnd(model.totals.tip) }
  ], y);
  y = drawSummaryBoxes(ops, [
    { label: t(lang, 'kind_other'), value: formatTnd(model.totals.other_staff) },
    { label: t(lang, 'total'), value: formatTnd(model.totals.total) }
  ], y);
  y -= 4;
  y = drawTableHeader(ops, columns, y);

  if (model.empty) {
    addText(ops, MARGIN, y - 18, model.emptyMessage, { size: 10, color: MUTED });
  } else {
    model.rows.forEach((row, index) => {
      const values = [row.date, row.kind, row.paidBy, row.note, row.amount];
      const height = measureRow(columns, values);
      if (y - height < 64) {
        ops = newDocumentPage(pages, lang);
        y = PAGE_H - 56;
        y = drawTableHeader(ops, columns, y);
      }
      drawRow(ops, columns, values, y, height, { zebra: index % 2 === 1, amountOut: true });
      y -= height;
    });
    if (y < 64) {
      ops = newDocumentPage(pages, lang);
      y = PAGE_H - 56;
    }
    y -= 16;
    addText(ops, MARGIN + CONTENT_W, y, `${t(lang, 'grand_total')}: ${formatTnd(model.totals.total)}`, {
      size: 11,
      color: NAVY,
      align: 'right'
    });
  }

  finalizePageNumbers(pages, lang);
  return buildPdf(pages);
}

function safeName(value) {
  return String(value || 'MixMax').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 40);
}

export function downloadStatementPdf(bookings, lang = 'de') {
  const names = {
    de: 'MixMax-Kontoauszug',
    en: 'MixMax-Statement',
    fr: 'MixMax-Releve'
  };
  downloadPdf(renderStatementPdf(bookings, lang), `${names[lang] || names.de}-${todayISO()}.pdf`);
}

export function downloadStaffPdf(bookings, filter, lang = 'de') {
  const names = {
    de: 'MixMax-Personal-Zahlungsnachweis',
    en: 'MixMax-Staff-Payment-Statement',
    fr: 'MixMax-Releve-Paiements-Personnel'
  };
  const suffix = [safeName(filter?.employeeName), filter?.year, filter?.month || 'year'].filter(Boolean).join('-');
  downloadPdf(renderStaffPdf(bookings, filter, lang), `${names[lang] || names.de}-${suffix}.pdf`);
}
