import { formatTnd, formatTndNumber } from './money.js';
import { sortOldestFirst, summarize } from './bookings.js';
import { formatDate } from './format.js';
import { categoryLabel, paidByLabelI18n, t, typeLabelI18n } from './i18n.js';

function pdfEsc(value) {
  return String(value == null ? '' : value)
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/([\\()])/g, '\\$1');
}

function buildPdf(lines) {
  let content = 'BT /F1 10 Tf 50 820 Td ';
  lines.forEach((line, i) => {
    content += (i ? '0 -15 Td ' : '') + '(' + pdfEsc(line) + ') Tj ';
  });
  content += 'ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'
  ];
  let pdf = '%PDF-1.4\n';
  const offs = [0];
  objs.forEach((obj, i) => {
    offs.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const x = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offs.slice(1).forEach((o) => {
    pdf += String(o).padStart(10, '0') + ' 00000 n \n';
  });
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
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

export function downloadStatementPdf(bookings, lang = 'de') {
  const totals = summarize(bookings);
  const lines = [
    'MixMax Manager - ' + t(lang, 'statement_title'),
    t(lang, 'created') + ': ' + formatDate(new Date().toISOString().slice(0, 10), lang),
    t(lang, 'current_balance') + ': ' + formatTnd(totals.balance),
    t(lang, 'income') + ': ' + formatTnd(totals.totalIn),
    t(lang, 'expenses') + ': ' + formatTnd(totals.totalOut),
    '',
    t(lang, 'col_date') + '       ' + t(lang, 'col_type') + '          ' + t(lang, 'col_category') + '                 ' + t(lang, 'col_paid_by') + '   ' + t(lang, 'col_amount')
  ];
  sortOldestFirst(bookings).forEach((booking) => {
    const sign = booking.type === 'in' ? '+' : '-';
    lines.push(
      formatDate(booking.date, lang).padEnd(12)
      + typeLabelI18n(lang, booking.type).padEnd(13)
      + String(categoryLabel(lang, booking.category) || '').slice(0, 23).padEnd(25)
      + paidByLabelI18n(lang, booking.paid_by).padEnd(14)
      + sign + formatTndNumber(booking.amount) + ' TND'
    );
    if (booking.item) lines.push('  ' + t(lang, 'pdf_item') + ': ' + String(booking.item).slice(0, 60));
    if (booking.employee_name) lines.push('  ' + t(lang, 'pdf_advance') + ': ' + String(booking.employee_name).slice(0, 60));
    if (booking.note) lines.push('  ' + String(booking.note).slice(0, 70));
  });
  downloadPdf(buildPdf(lines), 'MixMax-Kontoauszug-' + new Date().toISOString().slice(0, 10) + '.pdf');
}
