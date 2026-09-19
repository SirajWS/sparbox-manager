import { STAFF_PAYMENT_KINDS } from './bookings.js';
import { esc } from './format.js';
import { monthShortLabel, staffKindLabel, t } from './i18n.js';

export const STAFF_KIND_COLORS = {
  salary: '#183653',
  employee_advance: '#2db57c',
  tip: '#d4a24c',
  other_staff: '#7b8fa6'
};

export function chartScaleMax(months) {
  const max = Math.max(0, ...(months || []).map((row) => Number(row.total) || 0));
  return max > 0 ? max : 1;
}

export function stackedPercents(month, max) {
  const scale = max > 0 ? max : 1;
  const result = {};
  for (const kind of STAFF_PAYMENT_KINDS) {
    result[kind] = ((Number(month?.[kind]) || 0) / scale) * 100;
  }
  return result;
}

export function renderStaffChartHtml(months, lang, formatTnd) {
  const max = chartScaleMax(months);
  const cols = (months || []).map((month) => {
    const percents = stackedPercents(month, max);
    const segments = STAFF_PAYMENT_KINDS.map((kind) => {
      const pct = percents[kind];
      if (pct <= 0) return '';
      return `<span class="staff-seg" data-kind="${kind}" style="height:${pct.toFixed(2)}%;background:${STAFF_KIND_COLORS[kind]}"></span>`;
    }).join('');
    const label = monthShortLabel(lang, month.month);
    const tipLines = [
      label,
      `${staffKindLabel(lang, 'salary')}: ${formatTnd(month.salary)}`,
      `${staffKindLabel(lang, 'employee_advance')}: ${formatTnd(month.employee_advance)}`,
      `${staffKindLabel(lang, 'tip')}: ${formatTnd(month.tip)}`,
      `${staffKindLabel(lang, 'other_staff')}: ${formatTnd(month.other_staff)}`,
      `${t(lang, 'total')}: ${formatTnd(month.total)}`
    ];
    return `<div class="staff-col" title="${esc(tipLines.join('\n'))}">
      <div class="staff-tooltip">${tipLines.map((line) => `<div>${esc(line)}</div>`).join('')}</div>
      <div class="staff-bar">${segments}</div>
      <span class="staff-col-label">${esc(label)}</span>
    </div>`;
  }).join('');

  const legend = STAFF_PAYMENT_KINDS.map((kind) => (
    `<span class="staff-legend-item"><i style="background:${STAFF_KIND_COLORS[kind]}"></i>${staffKindLabel(lang, kind)}</span>`
  )).join('');

  return `<div class="staff-chart-scroll">
    <div class="staff-chart-plot">${cols}</div>
  </div>
  <div class="staff-legend">${legend}</div>`;
}
