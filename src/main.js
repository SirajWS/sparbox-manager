import './styles.css';
import { createSupabase, getSupabaseConfig } from './lib/supabaseClient.js';
import {
  applyDelete,
  applyInsert,
  applyUpdate,
  availableYears,
  bookingFingerprint,
  bookingToForm,
  bookingTitle,
  canExplicitSave,
  canStartSave,
  categoriesForType,
  filterStaffPayments,
  isFormComplete,
  isStaffPaymentKind,
  needsCustomItemName,
  runningBalances,
  sortNewestFirst,
  staffEmployeeNames,
  staffKindTotals,
  staffPaymentSummaries,
  staffPayments,
  staffYearMonths,
  summarize,
  toNormalPayload,
  toStaffPaymentPayload,
  toUpdatePayload
} from './lib/bookings.js';
import {
  applyEmployeeDelete,
  applyEmployeeInsert,
  canRecordAdvance,
  validateEmployeeName
} from './lib/employees.js';
import { CUSTOM_ITEM, PURCHASE_CATEGORY, PURCHASE_ITEMS } from './lib/catalog.js';
import { formatTnd, parseAmount } from './lib/money.js';
import { esc, formatDate, isNetworkError, todayISO } from './lib/format.js';
import { downloadStaffPdf, downloadStatementPdf, loadPdfLogo } from './lib/pdf.js';
import { renderStaffChartHtml } from './lib/staffChart.js';
import {
  applyStaticI18n,
  categoryLabel,
  itemLabel,
  loadLanguage,
  localeFor,
  monthLongLabel,
  paidByLabelI18n,
  saveLanguage,
  staffKindLabel,
  t,
  typeLabelI18n
} from './lib/i18n.js';

const VIEW_KEYS = {
  overview: 'nav_overview',
  bookings: 'nav_bookings',
  employees: 'nav_employees',
  statement: 'nav_statement',
  settings: 'nav_settings'
};

const BOOKING_COLUMNS = 'id,type,amount,currency,category,item,note,date,paid_by,booking_kind,employee_name,created_at,created_by';

const supabase = createSupabase();
const $ = (sel) => document.querySelector(sel);

let lang = loadLanguage(window.localStorage);
let session = null;
let bookings = [];
let employees = [];
let realtimeChannel = null;
let savingLock = false;
let inFlightFingerprint = null;
let currentView = 'overview';
let staffFilterEmployee = '';
let staffFilterYear = new Date().getFullYear();
let staffFilterMonth = '';
let editingId = null;
const editState = {
  type: 'out',
  paidBy: '',
  bookingKind: 'normal',
  staff: false
};

const formState = {
  type: 'out',
  paidBy: '',
  get amount() { return parseAmount($('#amount-input').value); },
  get category() { return $('#category-input').value; },
  get item() { return $('#item-input').value; },
  get itemName() { return $('#item-name-input').value; },
  get date() { return $('#date-input').value; },
  get note() { return $('#note-input').value; }
};

const advanceState = {
  paidBy: '',
  bookingKind: 'employee_advance',
  get employeeName() { return $('#employee-input').value; },
  get amount() { return parseAmount($('#advance-amount-input').value); },
  get date() { return $('#advance-date-input').value; },
  get note() { return $('#advance-note-input').value; }
};

function showToast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function setHidden(id, hidden) {
  const el = document.getElementById(id);
  if (el) el.hidden = hidden;
}

function setScreen({ boot = true, setup = true, login = true, app = true }) {
  setHidden('boot', boot);
  setHidden('setup-screen', setup);
  setHidden('login-screen', login);
  setHidden('app', app);
}

function tickClock() {
  const now = new Date();
  const locale = localeFor(lang);
  $('#clock-time').textContent = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  $('#clock-date').textContent = now.toLocaleDateString(locale);
  $('#today-label').textContent = now.toLocaleDateString(locale, { weekday: 'long' });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  $('#view-title').textContent = t(lang, VIEW_KEYS[view] || view);
  $('#sidebar').classList.remove('open');
  if (view === 'bookings') $('#amount-input').focus();
  if (view === 'employees') {
    if (canRecordAdvance(employees)) $('#advance-amount-input').focus();
    else $('#employee-name-input').focus();
  }
}

function fillCategories() {
  const select = $('#category-input');
  const options = categoriesForType(formState.type);
  const keep = options.includes(select.value) ? select.value : '';
  select.innerHTML = `<option value="">${esc(t(lang, 'category_placeholder'))}</option>`
    + options.map((name) => `<option value="${esc(name)}">${esc(categoryLabel(lang, name))}</option>`).join('');
  select.value = keep;
  syncItemFields();
}

function fillItems() {
  const select = $('#item-input');
  const keep = PURCHASE_ITEMS.includes(select.value) ? select.value : '';
  select.innerHTML = `<option value="">${esc(t(lang, 'item_placeholder'))}</option>`
    + PURCHASE_ITEMS.map((name) => `<option value="${esc(name)}">${esc(itemLabel(lang, name))}</option>`).join('');
  select.value = keep;
}

function fillEmployees() {
  const select = $('#employee-input');
  const keep = employees.some((row) => row.name === select.value) ? select.value : '';
  const hasEmployees = canRecordAdvance(employees);
  $('#no-employees-hint').hidden = hasEmployees;
  select.disabled = !hasEmployees;
  $('#advance-amount-input').disabled = !hasEmployees;
  $('#advance-date-input').disabled = !hasEmployees;
  $('#advance-note-input').disabled = !hasEmployees;
  document.querySelectorAll('[data-advance-paid-by], [data-staff-kind]').forEach((btn) => { btn.disabled = !hasEmployees; });
  if (!hasEmployees) {
    select.innerHTML = `<option value="">${esc(t(lang, 'no_employees'))}</option>`;
    return;
  }
  select.innerHTML = `<option value="">${esc(t(lang, 'employee_placeholder'))}</option>`
    + employees.map((row) => `<option value="${esc(row.name)}">${esc(row.name)}</option>`).join('');
  select.value = keep;
}

function syncItemFields() {
  const showItem = formState.type === 'out' && formState.category === PURCHASE_CATEGORY;
  $('#item-field').hidden = !showItem;
  $('#item-name-field').hidden = !showItem || formState.item !== CUSTOM_ITEM;
  if (!showItem) {
    $('#item-input').value = '';
    $('#item-name-input').value = '';
  }
}

function readBookingForm() {
  return {
    type: formState.type,
    amount: formState.amount,
    category: formState.category,
    item: formState.item,
    itemName: formState.itemName,
    date: formState.date,
    paidBy: formState.paidBy,
    note: formState.note,
    bookingKind: 'normal'
  };
}

function readAdvanceForm() {
  return {
    bookingKind: advanceState.bookingKind,
    employeeName: advanceState.employeeName,
    amount: advanceState.amount,
    date: advanceState.date,
    paidBy: advanceState.paidBy,
    note: advanceState.note
  };
}

function setFormError(id, message) {
  const el = $(id);
  el.hidden = !message;
  el.textContent = message || '';
}

function bookingRow(booking, compact = false) {
  const out = booking.type === 'out';
  const note = booking.note ? `<small>${esc(booking.note)}</small>` : '';
  const remove = compact ? '' : `<div class="booking-action-row">
      <button type="button" class="text-button" data-edit="${esc(booking.id)}">${esc(t(lang, 'edit'))}</button>
      <button type="button" class="text-button danger" data-remove="${esc(booking.id)}">${esc(t(lang, 'remove'))}</button>
    </div>`;
  const title = booking.item
    ? `${categoryLabel(lang, booking.category)} · ${itemLabel(lang, booking.item)}`
    : bookingTitle(booking, {
      salary: staffKindLabel(lang, 'salary'),
      employee_advance: staffKindLabel(lang, 'employee_advance'),
      tip: staffKindLabel(lang, 'tip'),
      other_staff: staffKindLabel(lang, 'other_staff'),
      advance: t(lang, 'advance_label'),
      employee: t(lang, 'employee')
    });
  return `<article class="booking-item">
    <div class="booking-copy">
      <strong>${esc(title)}</strong>
      <small>${formatDate(booking.date, lang)} · ${typeLabelI18n(lang, booking.type)} · ${paidByLabelI18n(lang, booking.paid_by)}</small>
      ${note}
    </div>
    <div class="booking-actions">
      <span class="amount ${out ? 'out' : ''}">${out ? '−' : '+'}${formatTnd(booking.amount)}</span>
      ${remove}
    </div>
  </article>`;
}

function renderOverview() {
  const totals = summarize(bookings);
  $('#balance-value').textContent = formatTnd(totals.balance);
  $('#sum-in').textContent = formatTnd(totals.totalIn);
  $('#sum-out').textContent = formatTnd(totals.totalOut);
  $('#sum-siraj').textContent = formatTnd(totals.paidBySiraj);
  $('#sum-chedi').textContent = formatTnd(totals.paidByChedi);
  const recent = sortNewestFirst(bookings).slice(0, 6);
  $('#recent-bookings').innerHTML = recent.length
    ? recent.map((row) => bookingRow(row, true)).join('')
    : `<div class="empty">${esc(t(lang, 'no_bookings'))}</div>`;
}

function renderBookingList() {
  const rows = sortNewestFirst(bookings);
  $('#booking-list').innerHTML = rows.length
    ? rows.map((row) => bookingRow(row)).join('')
    : `<div class="empty">${esc(t(lang, 'no_bookings_saved'))}</div>`;
}

function renderEmployeeChips() {
  $('#employee-chips').innerHTML = employees.length
    ? employees.map((row) => `<span class="employee-chip">${esc(row.name)}<button type="button" class="text-button danger" data-remove-employee="${esc(row.id)}">${esc(t(lang, 'remove'))}</button></span>`).join('')
    : '';
}

function syncStaffFilters() {
  const names = staffEmployeeNames(bookings, employees);
  if (!names.includes(staffFilterEmployee)) staffFilterEmployee = names[0] || '';
  const years = availableYears(bookings);
  if (!years.includes(Number(staffFilterYear))) staffFilterYear = years[0];

  const employeeSelect = $('#staff-employee-filter');
  employeeSelect.innerHTML = names.length
    ? names.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('')
    : `<option value="">${esc(t(lang, 'no_employees'))}</option>`;
  employeeSelect.value = staffFilterEmployee;
  employeeSelect.disabled = !names.length;

  const yearSelect = $('#staff-year-filter');
  yearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');
  yearSelect.value = String(staffFilterYear);

  const monthSelect = $('#staff-month-filter');
  monthSelect.innerHTML = `<option value="">${esc(t(lang, 'whole_year'))}</option>`
    + Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const value = String(month).padStart(2, '0');
      return `<option value="${value}">${esc(monthLongLabel(lang, month))}</option>`;
    }).join('');
  monthSelect.value = staffFilterMonth;
  $('#staff-pdf-btn').disabled = !staffFilterEmployee;
}

function renderEmployees() {
  fillEmployees();
  renderEmployeeChips();
  syncStaffFilters();

  const yearRows = filterStaffPayments(bookings, {
    employeeName: staffFilterEmployee,
    year: staffFilterYear
  });
  const totals = staffKindTotals(yearRows);
  $('#staff-kind-totals').innerHTML = staffFilterEmployee
    ? `
      <div><small>${esc(staffKindLabel(lang, 'salary'))}</small><strong>${formatTnd(totals.salary)}</strong></div>
      <div><small>${esc(staffKindLabel(lang, 'employee_advance'))}</small><strong>${formatTnd(totals.employee_advance)}</strong></div>
      <div><small>${esc(staffKindLabel(lang, 'tip'))}</small><strong>${formatTnd(totals.tip)}</strong></div>
      <div><small>${esc(staffKindLabel(lang, 'other_staff'))}</small><strong>${formatTnd(totals.other_staff)}</strong></div>
      <div class="total-cell"><small>${esc(t(lang, 'total'))}</small><strong>${formatTnd(totals.total)}</strong></div>
    `
    : `<div class="empty">${esc(t(lang, 'no_staff_payments'))}</div>`;

  const months = staffYearMonths(bookings, staffFilterEmployee, staffFilterYear);
  $('#staff-chart').innerHTML = renderStaffChartHtml(months, lang, formatTnd);

  const summaries = staffPaymentSummaries(bookings, employees);
  $('#employee-summary').innerHTML = summaries.length
    ? summaries.map((row) => `
        <div>
          <small>${esc(row.name)}</small>
          <strong>${formatTnd(row.total)}</strong>
          <small>${row.last ? esc(t(lang, 'last_staff_payment', { date: formatDate(row.last.date, lang) })) : esc(t(lang, 'no_staff_payment_yet'))}</small>
        </div>
      `).join('')
    : `<div class="empty">${esc(t(lang, 'no_employees'))}</div>`;

  const rows = staffPayments(bookings);
  $('#advance-list').innerHTML = rows.length
    ? rows.map((row) => bookingRow(row)).join('')
    : `<div class="empty">${esc(t(lang, 'no_staff_payments'))}</div>`;
}

function renderStatement() {
  const totals = summarize(bookings);
  const stands = runningBalances(bookings);
  const rows = sortNewestFirst(bookings);
  const table = rows.length
    ? `<div class="table-wrap"><table>
        <thead><tr>
          <th>${esc(t(lang, 'col_date'))}</th>
          <th>${esc(t(lang, 'col_type'))}</th>
          <th>${esc(t(lang, 'col_category'))}</th>
          <th>${esc(t(lang, 'col_item_advance'))}</th>
          <th>${esc(t(lang, 'col_paid_by'))}</th>
          <th>${esc(t(lang, 'col_note'))}</th>
          <th class="right">${esc(t(lang, 'col_amount'))}</th>
          <th class="right">${esc(t(lang, 'col_balance'))}</th>
        </tr></thead>
        <tbody>${rows.map((booking) => {
          const out = booking.type === 'out';
          const extra = booking.employee_name || (booking.item ? itemLabel(lang, booking.item) : '–');
          return `<tr>
            <td>${formatDate(booking.date, lang)}</td>
            <td><span class="type-pill ${out ? 'out' : ''}">${typeLabelI18n(lang, booking.type)}</span></td>
            <td>${esc(categoryLabel(lang, booking.category))}</td>
            <td>${esc(extra)}</td>
            <td>${esc(paidByLabelI18n(lang, booking.paid_by))}</td>
            <td>${esc(booking.note || '–')}</td>
            <td class="right amount ${out ? 'out' : ''}">${out ? '−' : '+'}${formatTnd(booking.amount)}</td>
            <td class="right">${formatTnd(stands[booking.id])}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`
    : `<div class="empty">${esc(t(lang, 'no_bookings'))}</div>`;

  $('#statement-preview').innerHTML = `
    <div class="statement-brand">
      <div><span class="eyebrow">MixMax Manager</span><h2>${esc(t(lang, 'statement_title'))}</h2></div>
      <div>${formatDate(todayISO(), lang)}</div>
    </div>
    <div class="statement-summary">
      <div><small>${esc(t(lang, 'income'))}</small><strong>${formatTnd(totals.totalIn)}</strong></div>
      <div><small>${esc(t(lang, 'expenses'))}</small><strong class="col-red">${formatTnd(totals.totalOut)}</strong></div>
      <div><small>${esc(t(lang, 'current_balance'))}</small><strong>${formatTnd(totals.balance)}</strong></div>
    </div>
    ${table}`;
}

function renderAll() {
  applyLanguage();
  renderOverview();
  renderBookingList();
  renderEmployees();
  renderStatement();
}

function applyLanguage() {
  document.documentElement.lang = lang;
  applyStaticI18n(document, lang);
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  $('#view-title').textContent = t(lang, VIEW_KEYS[currentView] || currentView);
  fillCategories();
  fillItems();
  tickClock();
  syncAddButton();
  if (editingId) {
    applyStaticI18n($('#edit-dialog'), lang);
    fillEditSelects();
  }
}

function setLanguage(next) {
  lang = saveLanguage(next, window.localStorage);
  renderAll();
  syncAddButton();
  if (editingId) fillEditSelects();
}

function syncAddButton() {
  const btn = $('#add-booking-btn');
  if (!btn) return;
  btn.disabled = !canExplicitSave({
    complete: isFormComplete(readBookingForm()),
    savingLock
  });
}

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  bookings = data || [];
}

async function loadEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('id,name,created_at,created_by')
    .order('name');
  if (error) throw error;
  employees = data || [];
}

function subscribeRealtime() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel('mixmax-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
      bookings = applyInsert(bookings, payload.new);
      renderAll();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings' }, (payload) => {
      bookings = applyUpdate(bookings, payload.new);
      renderAll();
      syncAddButton();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bookings' }, (payload) => {
      bookings = applyDelete(bookings, payload.old?.id);
      renderAll();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employees' }, (payload) => {
      employees = applyEmployeeInsert(employees, payload.new);
      renderAll();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'employees' }, (payload) => {
      employees = applyEmployeeDelete(employees, payload.old?.id);
      renderAll();
    })
    .subscribe();
}

async function insertBooking(form, payload, onSuccess) {
  const fingerprint = bookingFingerprint(form);
  if (!canStartSave({
    complete: isFormComplete(form),
    fingerprint,
    savingLock,
    inFlightFingerprint
  })) return;

  savingLock = true;
  inFlightFingerprint = fingerprint;

  try {
    const { data, error } = await supabase.from('bookings').insert({
      ...payload,
      created_by: session.user.id
    }).select().single();
    if (error) throw error;
    bookings = applyInsert(bookings, data);
    renderAll();
    onSuccess(form, data);
  } catch (error) {
    throw error;
  } finally {
    savingLock = false;
    inFlightFingerprint = null;
  }
}

async function addBooking() {
  const form = readBookingForm();
  const btn = $('#add-booking-btn');
  setFormError('#booking-error', '');
  if (!isFormComplete(form)) {
    setFormError('#booking-error', t(lang, 'form_incomplete'));
    syncAddButton();
    return;
  }
  if (!canExplicitSave({ complete: true, savingLock })) return;
  btn.disabled = true;
  try {
    await insertBooking(form, toNormalPayload(form), () => {
      $('#amount-input').value = '';
      $('#note-input').value = '';
      if (needsCustomItemName(form)) $('#item-name-input').value = '';
      showToast(t(lang, 'saved', { amount: formatTnd(form.amount) }));
      $('#amount-input').focus();
    });
  } catch (error) {
    const message = isNetworkError(error) ? t(lang, 'save_offline') : t(lang, 'save_failed');
    setFormError('#booking-error', message);
    showToast(message);
  } finally {
    syncAddButton();
  }
}

async function trySaveAdvance() {
  if (!canRecordAdvance(employees)) return;
  const form = readAdvanceForm();
  setFormError('#advance-error', '');
  try {
    await insertBooking(form, toStaffPaymentPayload(form), () => {
      $('#advance-amount-input').value = '';
      $('#advance-note-input').value = '';
      showToast(t(lang, 'saved', { amount: formatTnd(form.amount) }));
      $('#advance-amount-input').focus();
    });
  } catch (error) {
    if (!isFormComplete(form)) return;
    const message = isNetworkError(error) ? t(lang, 'save_offline') : t(lang, 'save_failed');
    setFormError('#advance-error', message);
    showToast(message);
  }
}

function readEditForm() {
  const staff = editState.staff;
  return {
    type: staff ? 'out' : editState.type,
    amount: parseAmount($('#edit-amount-input').value),
    category: staff ? 'Personal' : $('#edit-category-input').value,
    item: $('#edit-item-input').value,
    itemName: $('#edit-item-name-input').value,
    date: $('#edit-date-input').value,
    paidBy: editState.paidBy,
    note: $('#edit-note-input').value,
    bookingKind: staff ? editState.bookingKind : 'normal',
    employeeName: $('#edit-employee-input').value
  };
}

function fillEditSelects() {
  const form = {
    type: editState.type,
    category: $('#edit-category-input').value,
    item: $('#edit-item-input').value
  };
  const cat = $('#edit-category-input');
  const options = categoriesForType(editState.type);
  const keepCat = options.includes(form.category) ? form.category : '';
  cat.innerHTML = `<option value="">${esc(t(lang, 'category_placeholder'))}</option>`
    + options.map((name) => `<option value="${esc(name)}">${esc(categoryLabel(lang, name))}</option>`).join('');
  cat.value = keepCat;

  const item = $('#edit-item-input');
  const keepItem = PURCHASE_ITEMS.includes(form.item) ? form.item : '';
  item.innerHTML = `<option value="">${esc(t(lang, 'item_placeholder'))}</option>`
    + PURCHASE_ITEMS.map((name) => `<option value="${esc(name)}">${esc(itemLabel(lang, name))}</option>`).join('');
  item.value = keepItem;

  const emp = $('#edit-employee-input');
  const names = employees.map((row) => row.name);
  const currentName = emp.value;
  const extra = currentName && !names.includes(currentName) ? currentName : '';
  emp.innerHTML = `<option value="">${esc(t(lang, 'employee_placeholder'))}</option>`
    + [...names, extra].filter(Boolean).map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if (currentName) emp.value = currentName;
  syncEditItemFields();
}

function syncEditItemFields() {
  const showItem = !editState.staff && editState.type === 'out' && $('#edit-category-input').value === PURCHASE_CATEGORY;
  $('#edit-item-field').hidden = !showItem;
  $('#edit-item-name-field').hidden = !showItem || $('#edit-item-input').value !== CUSTOM_ITEM;
  if (!showItem) {
    $('#edit-item-input').value = '';
    $('#edit-item-name-input').value = '';
  }
}

function setEditChoices() {
  document.querySelectorAll('[data-edit-type]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.editType === editState.type);
  });
  document.querySelectorAll('[data-edit-paid-by]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.editPaidBy === editState.paidBy);
  });
  document.querySelectorAll('[data-edit-kind]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.editKind === editState.bookingKind);
  });
}

function openEdit(id) {
  const booking = bookings.find((row) => row.id === id);
  if (!booking) return;
  const form = bookingToForm(booking);
  editingId = booking.id;
  editState.staff = isStaffPaymentKind(form.bookingKind);
  editState.type = form.type;
  editState.paidBy = form.paidBy;
  editState.bookingKind = form.bookingKind;
  $('#edit-type-field').hidden = editState.staff;
  $('#edit-category-field').hidden = editState.staff;
  $('#edit-employee-field').hidden = !editState.staff;
  $('#edit-kind-field').hidden = !editState.staff;
  fillEditSelects();
  $('#edit-amount-input').value = form.amount;
  $('#edit-category-input').value = form.category;
  $('#edit-item-input').value = form.item;
  $('#edit-item-name-input').value = form.itemName;
  $('#edit-date-input').value = form.date;
  $('#edit-note-input').value = form.note;
  $('#edit-employee-input').value = form.employeeName;
  if (form.employeeName && !$('#edit-employee-input').value) {
    const select = $('#edit-employee-input');
    select.insertAdjacentHTML('beforeend', `<option value="${esc(form.employeeName)}">${esc(form.employeeName)}</option>`);
    select.value = form.employeeName;
  }
  syncEditItemFields();
  setEditChoices();
  setFormError('#edit-error', '');
  $('#edit-dialog').hidden = false;
}

function closeEdit() {
  editingId = null;
  $('#edit-dialog').hidden = true;
  setFormError('#edit-error', '');
}

async function saveEdit() {
  if (!editingId) return;
  const existing = bookings.find((row) => row.id === editingId);
  if (!existing) return;
  const form = readEditForm();
  const btn = $('#edit-save-btn');
  setFormError('#edit-error', '');
  if (!isFormComplete(form)) {
    setFormError('#edit-error', t(lang, 'form_incomplete'));
    return;
  }
  if (savingLock) return;
  savingLock = true;
  btn.disabled = true;
  const previous = existing;
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update(toUpdatePayload(form))
      .eq('id', editingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error) throw error;
    if (data.id !== existing.id) throw new Error('identity-changed');
    bookings = applyUpdate(bookings, {
      ...data,
      created_at: existing.created_at,
      created_by: existing.created_by,
      id: existing.id
    });
    renderAll();
    closeEdit();
    showToast(t(lang, 'updated', { amount: formatTnd(form.amount) }));
  } catch (error) {
    bookings = applyUpdate(bookings, previous);
    renderAll();
    const message = isNetworkError(error) ? t(lang, 'update_offline') : t(lang, 'update_failed');
    setFormError('#edit-error', message);
    showToast(message);
  } finally {
    savingLock = false;
    btn.disabled = false;
  }
}

async function removeBooking(id) {
  const booking = bookings.find((row) => row.id === id);
  if (!booking) return;
  const ok = window.confirm(t(lang, 'confirm_remove_booking', { amount: formatTnd(booking.amount) }));
  if (!ok) return;
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) {
    showToast(isNetworkError(error) ? t(lang, 'delete_offline') : t(lang, 'delete_failed'));
    return;
  }
  bookings = applyDelete(bookings, id);
  renderAll();
}

async function addEmployee(event) {
  event.preventDefault();
  const checked = validateEmployeeName($('#employee-name-input').value, employees);
  if (!checked.ok) {
    setFormError('#employee-error', t(lang, checked.error === 'duplicate' ? 'employee_duplicate' : 'employee_empty'));
    return;
  }
  setFormError('#employee-error', '');
  const { data, error } = await supabase.from('employees').insert({
    name: checked.name,
    created_by: session.user.id
  }).select().single();
  if (error) {
    const duplicate = /duplicate|unique/i.test(error.message || '');
    setFormError('#employee-error', duplicate ? t(lang, 'employee_duplicate') : t(lang, 'employee_save_failed'));
    return;
  }
  employees = applyEmployeeInsert(employees, data);
  $('#employee-name-input').value = '';
  renderAll();
}

async function removeEmployee(id) {
  const employee = employees.find((row) => row.id === id);
  if (!employee) return;
  const ok = window.confirm(t(lang, 'confirm_remove_employee', { name: employee.name }));
  if (!ok) return;
  const previousBookings = bookings;
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) {
    showToast(t(lang, 'employee_delete_failed'));
    return;
  }
  employees = applyEmployeeDelete(employees, id);
  bookings = previousBookings;
  renderAll();
}

function bindAmountCommit(input, saveFn) {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveFn();
    }
  });
  input.addEventListener('blur', () => saveFn());
}

function bindAppEvents() {
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.querySelectorAll('[data-view-jump]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.viewJump));
  });
  $('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#brand-link').addEventListener('click', (event) => {
    event.preventDefault();
    switchView('overview');
  });
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  document.querySelectorAll('[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formState.type = btn.dataset.type;
      document.querySelectorAll('[data-type]').forEach((el) => el.classList.toggle('active', el === btn));
      fillCategories();
      syncAddButton();
    });
  });

  document.querySelectorAll('[data-paid-by]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formState.paidBy = btn.dataset.paidBy;
      document.querySelectorAll('[data-paid-by]').forEach((el) => el.classList.toggle('active', el === btn));
      syncAddButton();
    });
  });

  document.querySelectorAll('[data-advance-paid-by]').forEach((btn) => {
    btn.addEventListener('click', () => {
      advanceState.paidBy = btn.dataset.advancePaidBy;
      document.querySelectorAll('[data-advance-paid-by]').forEach((el) => el.classList.toggle('active', el === btn));
      trySaveAdvance();
    });
  });

  document.querySelectorAll('[data-staff-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      advanceState.bookingKind = btn.dataset.staffKind;
      document.querySelectorAll('[data-staff-kind]').forEach((el) => el.classList.toggle('active', el === btn));
      trySaveAdvance();
    });
  });

  $('#staff-employee-filter').addEventListener('change', () => {
    staffFilterEmployee = $('#staff-employee-filter').value;
    renderEmployees();
  });
  $('#staff-year-filter').addEventListener('change', () => {
    staffFilterYear = Number($('#staff-year-filter').value);
    renderEmployees();
  });
  $('#staff-month-filter').addEventListener('change', () => {
    staffFilterMonth = $('#staff-month-filter').value;
  });
  $('#staff-pdf-btn').addEventListener('click', async () => {
    if (!staffFilterEmployee) return;
    downloadStaffPdf(bookings, {
      employeeName: staffFilterEmployee,
      year: staffFilterYear,
      month: staffFilterMonth || null
    }, lang, await loadPdfLogo());
  });

  $('#category-input').addEventListener('change', () => {
    syncItemFields();
    syncAddButton();
  });
  $('#item-input').addEventListener('change', () => {
    syncItemFields();
    syncAddButton();
  });
  $('#item-name-input').addEventListener('input', syncAddButton);
  $('#amount-input').addEventListener('input', syncAddButton);
  $('#amount-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault();
  });
  $('#date-input').addEventListener('change', syncAddButton);
  $('#note-input').addEventListener('input', syncAddButton);
  $('#employee-input').addEventListener('change', () => trySaveAdvance());
  $('#advance-date-input').addEventListener('change', () => trySaveAdvance());

  bindAmountCommit($('#advance-amount-input'), trySaveAdvance);
  $('#booking-form').addEventListener('submit', (event) => event.preventDefault());
  $('#add-booking-btn').addEventListener('click', addBooking);
  $('#advance-form').addEventListener('submit', (event) => event.preventDefault());
  $('#employee-form').addEventListener('submit', addEmployee);

  $('#booking-list').addEventListener('click', (event) => {
    const editBtn = event.target.closest('[data-edit]');
    if (editBtn) openEdit(editBtn.dataset.edit);
    const btn = event.target.closest('[data-remove]');
    if (btn) removeBooking(btn.dataset.remove);
  });
  $('#advance-list').addEventListener('click', (event) => {
    const editBtn = event.target.closest('[data-edit]');
    if (editBtn) openEdit(editBtn.dataset.edit);
    const btn = event.target.closest('[data-remove]');
    if (btn) removeBooking(btn.dataset.remove);
  });
  document.querySelectorAll('[data-edit-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editState.type = btn.dataset.editType;
      setEditChoices();
      fillEditSelects();
    });
  });
  document.querySelectorAll('[data-edit-paid-by]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editState.paidBy = btn.dataset.editPaidBy;
      setEditChoices();
    });
  });
  document.querySelectorAll('[data-edit-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editState.bookingKind = btn.dataset.editKind;
      setEditChoices();
    });
  });
  $('#edit-category-input').addEventListener('change', syncEditItemFields);
  $('#edit-item-input').addEventListener('change', syncEditItemFields);
  $('#edit-save-btn').addEventListener('click', saveEdit);
  $('#edit-cancel-btn').addEventListener('click', closeEdit);
  $('#edit-form').addEventListener('submit', (event) => event.preventDefault());
  $('#edit-dialog').addEventListener('click', (event) => {
    if (event.target.id === 'edit-dialog') closeEdit();
  });
  $('#employee-chips').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove-employee]');
    if (btn) removeEmployee(btn.dataset.removeEmployee);
  });

  $('#download-pdf').addEventListener('click', async () => {
    downloadStatementPdf(bookings, lang, await loadPdfLogo());
  });
  $('#logout-btn').addEventListener('click', () => supabase.auth.signOut());
}

function resetTodayDates() {
  const today = todayISO();
  $('#date-input').value = today;
  $('#advance-date-input').value = today;
}

async function showApp(nextSession) {
  session = nextSession;
  $('#session-email').textContent = nextSession.user.email || t(lang, 'signed_in');
  resetTodayDates();
  setScreen({ boot: true, setup: true, login: true, app: false });
  try {
    await loadBookings();
  } catch (error) {
    showToast(isNetworkError(error) ? t(lang, 'load_offline') : t(lang, 'load_failed'));
  }
  try {
    await loadEmployees();
  } catch {
    employees = [];
  }
  renderAll();
  subscribeRealtime();
}

function showLogin() {
  session = null;
  bookings = [];
  employees = [];
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  $('#login-error').hidden = true;
  $('#login-form').reset();
  setScreen({ boot: true, setup: true, login: false, app: true });
  applyLanguage();
}

async function handleLogin(event) {
  event.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const errorEl = $('#login-error');
  const submit = $('#login-submit');
  errorEl.hidden = true;
  submit.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (error) {
    errorEl.textContent = isNetworkError(error) ? t(lang, 'login_offline') : t(lang, 'login_failed');
    errorEl.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

function start() {
  applyLanguage();
  tickClock();
  setInterval(tickClock, 1000);
  bindAppEvents();
  resetTodayDates();
  $('#login-form').addEventListener('submit', handleLogin);

  if (!getSupabaseConfig().configured) {
    setScreen({ boot: true, setup: false, login: true, app: true });
    applyLanguage();
    return;
  }

  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (nextSession && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      showApp(nextSession);
    } else if (nextSession) {
      session = nextSession;
    } else {
      showLogin();
    }
  });
}

start();
