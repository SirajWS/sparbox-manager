import './styles.css';
import { createSupabase, getSupabaseConfig } from './lib/supabaseClient.js';
import {
  applyDelete,
  applyInsert,
  bookingFingerprint,
  canStartSave,
  categoriesForType,
  isFormComplete,
  paidByLabel,
  runningBalances,
  sortNewestFirst,
  summarize,
  typeLabel
} from './lib/bookings.js';
import { formatTnd, parseAmount } from './lib/money.js';
import { esc, formatDate, isNetworkError, todayISO } from './lib/format.js';
import { downloadStatementPdf } from './lib/pdf.js';

const VIEWS = {
  overview: 'Übersicht',
  bookings: 'Buchungen',
  statement: 'Kontoauszug',
  settings: 'Einstellungen'
};

const supabase = createSupabase();
const $ = (sel) => document.querySelector(sel);

let session = null;
let bookings = [];
let realtimeChannel = null;
let savingLock = false;
let inFlightFingerprint = null;
let currentView = 'overview';

const formState = {
  type: 'out',
  paidBy: '',
  get amount() { return parseAmount($('#amount-input').value); },
  get category() { return $('#category-input').value; },
  get date() { return $('#date-input').value; },
  get note() { return $('#note-input').value; }
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
  $('#clock-time').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  $('#clock-date').textContent = now.toLocaleDateString('de-DE');
  $('#today-label').textContent = now.toLocaleDateString('de-DE', { weekday: 'long' });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  $('#view-title').textContent = VIEWS[view] || view;
  $('#sidebar').classList.remove('open');
  if (view === 'bookings') $('#amount-input').focus();
}

function fillCategories() {
  const select = $('#category-input');
  const options = categoriesForType(formState.type);
  const keep = options.includes(select.value) ? select.value : '';
  select.innerHTML = '<option value="">Kategorie wählen</option>'
    + options.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  select.value = keep;
}

function readForm() {
  return {
    type: formState.type,
    amount: formState.amount,
    category: formState.category,
    date: formState.date,
    paidBy: formState.paidBy,
    note: formState.note
  };
}

function setBookingError(message) {
  const el = $('#booking-error');
  el.hidden = !message;
  el.textContent = message || '';
}

function bookingRow(booking, compact = false) {
  const out = booking.type === 'out';
  const note = booking.note ? `<small>${esc(booking.note)}</small>` : '';
  const remove = compact ? '' : `<button type="button" class="text-button danger" data-remove="${esc(booking.id)}">Entfernen</button>`;
  return `<article class="booking-item">
    <div class="booking-copy">
      <strong>${esc(booking.category)}</strong>
      <small>${formatDate(booking.date)} · ${typeLabel(booking.type)} · ${paidByLabel(booking.paid_by)}</small>
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
  const recent = sortNewestFirst(bookings).slice(0, 8);
  $('#recent-bookings').innerHTML = recent.length
    ? recent.map((row) => bookingRow(row, true)).join('')
    : '<div class="empty">Noch keine Buchungen.</div>';
}

function renderBookingList() {
  const rows = sortNewestFirst(bookings);
  $('#booking-list').innerHTML = rows.length
    ? rows.map((row) => bookingRow(row)).join('')
    : '<div class="empty">Noch keine Buchungen gespeichert.</div>';
}

function renderStatement() {
  const totals = summarize(bookings);
  const stands = runningBalances(bookings);
  const rows = sortNewestFirst(bookings);
  const table = rows.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Datum</th><th>Typ</th><th>Kategorie</th><th>Bezahlt von</th><th>Beschreibung</th><th class="right">Betrag</th><th class="right">Stand</th></tr></thead>
        <tbody>${rows.map((booking) => {
          const out = booking.type === 'out';
          return `<tr>
            <td>${formatDate(booking.date)}</td>
            <td><span class="type-pill ${out ? 'out' : ''}">${typeLabel(booking.type)}</span></td>
            <td>${esc(booking.category)}</td>
            <td>${esc(paidByLabel(booking.paid_by))}</td>
            <td>${esc(booking.note || '–')}</td>
            <td class="right amount ${out ? 'out' : ''}">${out ? '−' : '+'}${formatTnd(booking.amount)}</td>
            <td class="right">${formatTnd(stands[booking.id])}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`
    : '<div class="empty">Noch keine Buchungen.</div>';

  $('#statement-preview').innerHTML = `
    <div class="statement-brand">
      <div><span class="eyebrow">MixMax Manager</span><h2>Kontoauszug</h2></div>
      <div>${formatDate(todayISO())}</div>
    </div>
    <div class="statement-summary">
      <div><small>Einzahlungen</small><strong>${formatTnd(totals.totalIn)}</strong></div>
      <div><small>Ausgaben</small><strong class="col-red">${formatTnd(totals.totalOut)}</strong></div>
      <div><small>Aktueller Stand</small><strong>${formatTnd(totals.balance)}</strong></div>
    </div>
    ${table}`;
}

function renderAll() {
  renderOverview();
  renderBookingList();
  renderStatement();
}

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('id,type,amount,currency,category,note,date,paid_by,created_at,created_by')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  bookings = data || [];
  renderAll();
}

function subscribeRealtime() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel('bookings-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload) => {
      bookings = applyInsert(bookings, payload.new);
      renderAll();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bookings' }, (payload) => {
      bookings = applyDelete(bookings, payload.old?.id);
      renderAll();
    })
    .subscribe();
}

async function trySaveBooking() {
  const form = readForm();
  const fingerprint = bookingFingerprint(form);
  if (!canStartSave({
    complete: isFormComplete(form),
    fingerprint,
    savingLock,
    inFlightFingerprint
  })) return;

  savingLock = true;
  inFlightFingerprint = fingerprint;
  setBookingError('');

  try {
    const { data, error } = await supabase.from('bookings').insert({
      type: form.type,
      amount: form.amount,
      currency: 'TND',
      category: form.category,
      note: String(form.note || '').trim() || null,
      date: form.date,
      paid_by: form.paidBy,
      created_by: session.user.id
    }).select().single();

    if (error) throw error;

    bookings = applyInsert(bookings, data);
    renderAll();
    $('#amount-input').value = '';
    $('#note-input').value = '';
    showToast(`${formatTnd(form.amount)} gespeichert`);
    $('#amount-input').focus();
  } catch (error) {
    const message = isNetworkError(error)
      ? 'Verbindung fehlgeschlagen. Buchung wurde nicht gespeichert.'
      : 'Speichern fehlgeschlagen. Buchung wurde nicht gespeichert.';
    setBookingError(message);
    showToast(message);
  } finally {
    savingLock = false;
    inFlightFingerprint = null;
  }
}

async function removeBooking(id) {
  const booking = bookings.find((row) => row.id === id);
  if (!booking) return;
  const ok = window.confirm(`Buchung über ${formatTnd(booking.amount)} wirklich entfernen?`);
  if (!ok) return;
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) {
    const message = isNetworkError(error)
      ? 'Verbindung fehlgeschlagen. Buchung wurde nicht gelöscht.'
      : 'Löschen fehlgeschlagen.';
    showToast(message);
    return;
  }
  bookings = applyDelete(bookings, id);
  renderAll();
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

  document.querySelectorAll('[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formState.type = btn.dataset.type;
      document.querySelectorAll('[data-type]').forEach((el) => el.classList.toggle('active', el === btn));
      fillCategories();
      trySaveBooking();
    });
  });

  document.querySelectorAll('[data-paid-by]').forEach((btn) => {
    btn.addEventListener('click', () => {
      formState.paidBy = btn.dataset.paidBy;
      document.querySelectorAll('[data-paid-by]').forEach((el) => el.classList.toggle('active', el === btn));
      trySaveBooking();
    });
  });

  $('#category-input').addEventListener('change', () => trySaveBooking());
  $('#date-input').addEventListener('change', () => trySaveBooking());
  $('#amount-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      trySaveBooking();
    }
  });
  $('#amount-input').addEventListener('blur', () => trySaveBooking());
  $('#booking-form').addEventListener('submit', (event) => event.preventDefault());

  $('#booking-list').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove]');
    if (btn) removeBooking(btn.dataset.remove);
  });

  $('#download-pdf').addEventListener('click', () => downloadStatementPdf(bookings));
  $('#logout-btn').addEventListener('click', () => supabase.auth.signOut());
}

async function showApp(nextSession) {
  session = nextSession;
  $('#session-email').textContent = nextSession.user.email || 'Angemeldet';
  $('#date-input').value = todayISO();
  fillCategories();
  setScreen({ boot: true, setup: true, login: true, app: false });
  try {
    await loadBookings();
    subscribeRealtime();
  } catch (error) {
    showToast(isNetworkError(error)
      ? 'Verbindung fehlgeschlagen. Buchungen konnten nicht geladen werden.'
      : 'Buchungen konnten nicht geladen werden.');
  }
}

function showLogin() {
  session = null;
  bookings = [];
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  $('#login-error').hidden = true;
  $('#login-form').reset();
  setScreen({ boot: true, setup: true, login: false, app: true });
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
    errorEl.textContent = isNetworkError(error)
      ? 'Verbindung fehlgeschlagen. Bitte erneut versuchen.'
      : 'Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.';
    errorEl.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

function start() {
  tickClock();
  setInterval(tickClock, 1000);
  bindAppEvents();
  $('#login-form').addEventListener('submit', handleLogin);

  if (!getSupabaseConfig().configured) {
    setScreen({ boot: true, setup: false, login: true, app: true });
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
