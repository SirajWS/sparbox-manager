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

function toHexStream(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return `${hex}>\n`;
}

function imageXObject(logo) {
  const rgbHex = toHexStream(logo.rgb);
  const alphaHex = toHexStream(logo.alpha);
  const rgb = `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /SMask 5 0 R /Length ${rgbHex.length} >>\nstream\n${rgbHex}endstream`;
  const mask = `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${alphaHex.length} >>\nstream\n${alphaHex}endstream`;
  return { rgb, mask };
}

function buildPdf(pages, logo = null) {
  const contentObjs = pages.map((ops) => {
    const stream = ops.join('\n');
    return `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  const pageCount = pages.length;
  const hasLogo = Boolean(logo?.rgb && logo?.alpha && logo.width && logo.height);
  const extra = hasLogo ? 2 : 0;
  const pageStart = 4 + extra;
  const kids = pages.map((_, i) => `${pageStart + i} 0 R`).join(' ');
  const xObject = hasLogo ? ' /XObject << /Im1 4 0 R >>' : '';
  const imageObjs = hasLogo ? imageXObject(logo) : null;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ...(imageObjs ? [imageObjs.rgb, imageObjs.mask] : []),
    ...pages.map((_, i) => (
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >>${xObject} >> /Contents ${pageStart + pageCount + i} 0 R >>`
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

const HEADER_H = 64;
const LOGO_PT = 46;
const CONTENT_TOP = PAGE_H - HEADER_H - 16;
const GOLD = [0.83, 0.635, 0.18];
const FOOTER_MIN = 48;

export const PDF_LOGO_SRC = './mixmax-logo-transparent.png';

export async function loadPdfLogo(src = PDF_LOGO_SRC) {
  if (typeof Image === 'undefined') return null;
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const scale = Math.max(size / img.width, size / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const rgb = new Uint8Array(size * size * 3);
    const alpha = new Uint8Array(size * size);
    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      rgb[p * 3] = pixels[i];
      rgb[p * 3 + 1] = pixels[i + 1];
      rgb[p * 3 + 2] = pixels[i + 2];
      alpha[p] = pixels[i + 3];
    }
    return { width: size, height: size, rgb, alpha };
  } catch {
    return null;
  }
}

function addPageChrome(ops, lang, pageNo, logo) {
  addFill(ops, 0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, NAVY);
  addFill(ops, 0, PAGE_H - HEADER_H - 2, PAGE_W, 2, GOLD);
  const hasLogo = Boolean(logo?.rgb);
  const textX = hasLogo ? MARGIN + LOGO_PT + 10 : MARGIN;
  if (hasLogo) {
    const y = PAGE_H - HEADER_H + (HEADER_H - LOGO_PT) / 2;
    ops.push(`q ${LOGO_PT} 0 0 ${LOGO_PT} ${MARGIN.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`);
  }
  addText(ops, textX, PAGE_H - 28, 'MixMax Manager', { size: 13, color: [1, 1, 1] });
  addText(ops, textX, PAGE_H - 42, t(lang, 'internal_admin'), { size: 7.5, color: [0.82, 0.86, 0.9] });
  addText(ops, PAGE_W - MARGIN, PAGE_H - 32, t(lang, 'page', { current: String(pageNo), total: '{total}' }), {
    size: 9,
    color: [1, 1, 1],
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
    subtitle: t(lang, 'staff_internal_sub'),
    employeeName: employeeName || t(lang, 'employee'),
    period: staffPeriodLabel(lang, year, month),
    created: formatDate(todayISO(), lang),
    totals,
    empty: rows.length === 0,
    emptyMessage: t(lang, 'no_staff_in_period'),
    hasSalary: totals.salary > 0,
    rows: rows.map((booking) => ({
      date: formatDate(booking.date, lang),
      kind: staffKindLabel(lang, bookingKindOf(booking)),
      kindKey: bookingKindOf(booking),
      paidBy: paidByLabelI18n(lang, booking.paid_by),
      note: userNote(booking) || '–',
      amount: formatTnd(booking.amount)
    }))
  };
}

function drawSummaryBoxes(ops, items, y) {
  const gap = 8;
  const boxH = 46;
  const boxW = (CONTENT_W - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const x = MARGIN + i * (boxW + gap);
    addFill(ops, x, y - boxH, boxW, boxH, SOFT);
    addFill(ops, x, y - 2.2, boxW, 2.2, item.accent || NAVY);
    addText(ops, x + 8, y - 14, item.label, { size: 7.5, color: MUTED, maxWidth: boxW - 16 });
    addText(ops, x + 8, y - 32, item.value, { size: 10.5, color: item.color || NAVY, maxWidth: boxW - 16 });
  });
  return y - boxH - 10;
}

function drawInfoBoxes(ops, items, y) {
  const gap = 8;
  const boxH = 42;
  const boxW = (CONTENT_W - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const x = MARGIN + i * (boxW + gap);
    addFill(ops, x, y - boxH, boxW, boxH, SOFT);
    addText(ops, x + 8, y - 12, item.label, { size: 7, color: MUTED, maxWidth: boxW - 16 });
    addText(ops, x + 8, y - 28, item.value, { size: 10, color: NAVY, maxWidth: boxW - 16 });
  });
  return y - boxH - 12;
}

function drawTotalBanner(ops, label, value, y) {
  addFill(ops, MARGIN, y - 30, CONTENT_W, 32, NAVY);
  addText(ops, MARGIN + 10, y - 18, label, { size: 10, color: [1, 1, 1] });
  addText(ops, MARGIN + CONTENT_W - 10, y - 18, value, { size: 11, color: [1, 1, 1], align: 'right' });
  return y - 42;
}

function drawSectionTitle(ops, y, text) {
  addText(ops, MARGIN, y, text, { size: 11, color: NAVY });
  return y - 16;
}

function drawKeyValuePanel(ops, title, rows, y) {
  const height = 22 + rows.length * 14;
  addFill(ops, MARGIN, y - height, CONTENT_W, height, SOFT);
  addText(ops, MARGIN + 10, y - 14, title, { size: 9, color: NAVY });
  rows.forEach((row, i) => {
    const rowY = y - 30 - i * 14;
    addText(ops, MARGIN + 10, rowY, row.label, { size: 8.5, color: MUTED, maxWidth: CONTENT_W / 2 });
    addText(ops, MARGIN + CONTENT_W - 10, rowY, row.value, { size: 8.5, color: NAVY, align: 'right' });
  });
  return y - height - 12;
}

function drawClosingNote(ops, lang, y) {
  addText(ops, MARGIN, y, t(lang, 'staff_note_title'), { size: 8, color: MUTED });
  y -= 12;
  wrapText(t(lang, 'staff_note'), CONTENT_W, 7.5).forEach((line) => {
    addText(ops, MARGIN, y, line, { size: 7.5, color: MUTED });
    y -= 10;
  });
  return y - 8;
}

function closingNoteHeight(lang) {
  return 20 + wrapText(t(lang, 'staff_note'), CONTENT_W, 7.5).length * 10 + 8;
}

function drawSignatures(ops, lang, y) {
  const gap = 48;
  const colW = (CONTENT_W - gap) / 2;
  addStroke(ops, MARGIN, y, MARGIN + colW, y, MUTED, 0.7);
  addStroke(ops, MARGIN + colW + gap, y, MARGIN + CONTENT_W, y, MUTED, 0.7);
  addText(ops, MARGIN, y - 12, t(lang, 'sign_employee'), { size: 8, color: MUTED });
  addText(ops, MARGIN + colW + gap, y - 12, t(lang, 'sign_management'), { size: 8, color: MUTED });
  return y - 24;
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

function newDocumentPage(pages, lang, logo) {
  const ops = createPage();
  pages.push(ops);
  addPageChrome(ops, lang, pages.length, logo);
  return ops;
}

function continueOnNewPage(pages, ops, y, needed, lang, logo, afterNewPage) {
  if (y - needed >= FOOTER_MIN) return { ops, y };
  ops = newDocumentPage(pages, lang, logo);
  y = CONTENT_TOP;
  if (afterNewPage) y = afterNewPage(ops, y);
  return { ops, y };
}

export function renderStatementPdf(bookings, lang = 'de', logo = null) {
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
  let ops = newDocumentPage(pages, lang, logo);
  let y = CONTENT_TOP;

  addText(ops, MARGIN, y, model.title, { size: 18, color: NAVY });
  y -= 18;
  addText(ops, MARGIN, y, `${t(lang, 'created_on')}: ${model.created}`, { size: 9, color: MUTED });
  y -= 22;

  y = drawSummaryBoxes(ops, [
    { label: t(lang, 'current_balance'), value: formatTnd(model.totals.balance), accent: NAVY },
    { label: t(lang, 'income'), value: formatTnd(model.totals.totalIn), color: GREEN, accent: GREEN },
    { label: t(lang, 'expenses'), value: formatTnd(model.totals.totalOut), color: RED, accent: RED }
  ], y);
  y = drawSummaryBoxes(ops, [
    { label: t(lang, 'expenses_siraj'), value: formatTnd(model.totals.paidBySiraj), accent: NAVY },
    { label: t(lang, 'expenses_chedi'), value: formatTnd(model.totals.paidByChedi), accent: NAVY }
  ], y);
  y -= 4;
  y = drawTableHeader(ops, columns, y);

  if (!model.rows.length) {
    addText(ops, MARGIN, y - 16, t(lang, 'no_bookings'), { size: 10, color: MUTED });
    y -= 28;
  }

  model.rows.forEach((row, index) => {
    const values = [row.date, row.type, row.category, row.description, row.paidBy, row.amount];
    const height = measureRow(columns, values);
    const next = continueOnNewPage(pages, ops, y, height, lang, logo, (pageOps, pageY) => drawTableHeader(pageOps, columns, pageY));
    ops = next.ops;
    y = next.y;
    drawRow(ops, columns, values, y, height, { zebra: index % 2 === 1, amountOut: row.out });
    y -= height;
  });

  const next = continueOnNewPage(pages, ops, y, 36, lang, logo);
  ops = next.ops;
  y = next.y - 12;
  addStroke(ops, MARGIN, y + 8, MARGIN + CONTENT_W, y + 8, LINE, 0.6);
  addText(ops, MARGIN + CONTENT_W, y - 6, `${t(lang, 'current_balance')}: ${formatTnd(model.totals.balance)}`, {
    size: 11,
    color: NAVY,
    align: 'right'
  });

  finalizePageNumbers(pages, lang);
  return buildPdf(pages, logo);
}

export function renderStaffPdf(bookings, filter, lang = 'de', logo = null) {
  const model = buildStaffStatementModel(bookings, filter, lang);
  const columns = [
    { key: 'date', label: t(lang, 'col_date'), width: 62 },
    { key: 'kind', label: t(lang, 'col_kind'), width: 88 },
    { key: 'paidBy', label: t(lang, 'col_paid_by'), width: 70 },
    { key: 'note', label: t(lang, 'col_note'), width: 191 },
    { key: 'amount', label: t(lang, 'col_amount'), width: 88, align: 'right', amount: true }
  ];
  const pages = [];
  let ops = newDocumentPage(pages, lang, logo);
  let y = CONTENT_TOP;

  addText(ops, MARGIN, y, model.title, { size: 18, color: NAVY });
  y -= 16;
  addText(ops, MARGIN, y, model.subtitle, { size: 8.5, color: MUTED });
  y -= 20;

  y = drawInfoBoxes(ops, [
    { label: t(lang, 'employee'), value: model.employeeName },
    { label: t(lang, 'period'), value: model.period },
    { label: t(lang, 'created_on'), value: model.created }
  ], y);

  y = drawSectionTitle(ops, y, t(lang, 'staff_summary'));
  y = drawSummaryBoxes(ops, [
    { label: t(lang, 'kind_salary'), value: formatTnd(model.totals.salary), accent: NAVY },
    { label: t(lang, 'kind_advance'), value: formatTnd(model.totals.employee_advance), accent: NAVY },
    { label: t(lang, 'kind_tip'), value: formatTnd(model.totals.tip), accent: NAVY },
    { label: t(lang, 'kind_other'), value: formatTnd(model.totals.other_staff), accent: NAVY }
  ], y);
  y = drawTotalBanner(ops, t(lang, 'total'), formatTnd(model.totals.total), y);

  if (model.hasSalary) {
    const next = continueOnNewPage(pages, ops, y, 140, lang, logo);
    ops = next.ops;
    y = next.y;
    y = drawKeyValuePanel(ops, t(lang, 'salary_overview'), [
      { label: t(lang, 'employee'), value: model.employeeName },
      { label: t(lang, 'period'), value: model.period },
      { label: t(lang, 'kind_salary'), value: formatTnd(model.totals.salary) },
      { label: t(lang, 'advances_plural'), value: formatTnd(model.totals.employee_advance) },
      { label: t(lang, 'kind_tip'), value: formatTnd(model.totals.tip) },
      { label: t(lang, 'other_staff_payments'), value: formatTnd(model.totals.other_staff) },
      { label: t(lang, 'total_staff_payments'), value: formatTnd(model.totals.total) }
    ], y);
  }

  const tableStart = continueOnNewPage(pages, ops, y, 48, lang, logo);
  ops = tableStart.ops;
  y = tableStart.y;
  y = drawSectionTitle(ops, y, t(lang, 'payment_details'));
  y = drawTableHeader(ops, columns, y);

  if (model.empty) {
    addText(ops, MARGIN, y - 18, model.emptyMessage, { size: 10, color: MUTED });
    y -= 36;
  } else {
    model.rows.forEach((row, index) => {
      const values = [row.date, row.kind, row.paidBy, row.note, row.amount];
      const height = measureRow(columns, values);
      const next = continueOnNewPage(pages, ops, y, height, lang, logo, (pageOps, pageY) => {
        pageY = drawSectionTitle(pageOps, pageY, t(lang, 'payment_details'));
        return drawTableHeader(pageOps, columns, pageY);
      });
      ops = next.ops;
      y = next.y;
      drawRow(ops, columns, values, y, height, { zebra: index % 2 === 1, amountOut: true });
      y -= height;
    });
    const totalLine = continueOnNewPage(pages, ops, y, 28, lang, logo);
    ops = totalLine.ops;
    y = totalLine.y - 16;
    addText(ops, MARGIN + CONTENT_W, y, `${t(lang, 'grand_total')}: ${formatTnd(model.totals.total)}`, {
      size: 11,
      color: NAVY,
      align: 'right'
    });
    y -= 18;
  }

  const closingH = closingNoteHeight(lang) + 40;
  const closing = continueOnNewPage(pages, ops, y, closingH, lang, logo);
  ops = closing.ops;
  y = closing.y - 8;
  y = drawClosingNote(ops, lang, y);
  drawSignatures(ops, lang, y - 18);

  finalizePageNumbers(pages, lang);
  return buildPdf(pages, logo);
}

function safeName(value) {
  return String(value || 'MixMax').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 40);
}

export function statementPdfFilename(lang, date = todayISO()) {
  const names = {
    de: 'MixMax-Kontoauszug',
    en: 'MixMax-Statement',
    fr: 'MixMax-Releve'
  };
  return `${names[lang] || names.de}-${date}.pdf`;
}

export function staffPdfFilename(filter, lang = 'de') {
  const names = {
    de: 'MixMax-Personal-Zahlungsnachweis',
    en: 'MixMax-Staff-Payment-Statement',
    fr: 'MixMax-Releve-Paiements-Personnel'
  };
  const month = filter?.month ? String(filter.month).padStart(2, '0') : '';
  const parts = [safeName(filter?.employeeName), filter?.year, month].filter((part) => part !== '' && part != null);
  return `${names[lang] || names.de}-${parts.join('-')}.pdf`;
}

export function downloadStatementPdf(bookings, lang = 'de', logo = null) {
  downloadPdf(renderStatementPdf(bookings, lang, logo), statementPdfFilename(lang));
}

export function downloadStaffPdf(bookings, filter, lang = 'de', logo = null) {
  downloadPdf(renderStaffPdf(bookings, filter, lang, logo), staffPdfFilename(filter, lang));
}
