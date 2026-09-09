/* SparBox Manager – komplette Anwendungslogik */
'use strict';

const euro = new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR'});
const dateFmt = new Intl.DateTimeFormat('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});

const VIEWS = {
  overview:'Übersicht', transactions:'Buchungen', goal:'Sparziel',
  fines:'Strafen', expenses:'Ausgaben', statement:'Kontoauszug', settings:'Einstellungen'
};
const STATUS_FINE = {open:'Offen', installment:'Ratenzahlung', paid:'Bezahlt', paused:'Pausiert'};
const INTERVAL_LABEL = {once:'Einmalig', weekly:'Wöchentlich', monthly:'Monatlich', quarterly:'Vierteljährlich', yearly:'Jährlich'};

/* ── STANDARDDATEN ── */
const defaults = {
  goal: {name:'Notreserve', target:1000, date:'2026-12-31'},
  pin: '258014',
  transactions: [
    {id:1, type:'deposit', amount:50, note:'Startbetrag',      date:'2026-08-28T10:00:00'},
    {id:2, type:'deposit', amount:20, note:'Wochenbudget',     date:'2026-09-02T18:30:00'},
    {id:3, type:'deposit', amount:10, note:'Bargeld gespart',  date:'2026-09-05T12:15:00'},
    {id:4, type:'deposit', amount:5,  note:'Kleingeld',        date:'2026-09-07T20:10:00'},
    {id:5, type:'deposit', amount:20, note:'Einzahlung',       date:'2026-09-08T18:20:00'}
  ],
  fines: [
    {
      id:1001, name:'Bußgeld Tempoverstoß', creditor:'Ordnungsamt Musterstadt',
      reference:'OA-2026-4821', totalAmount:120, monthlyRate:30,
      nextDueDate:'2026-09-15', startDate:'2026-07-01',
      note:'Musterbeispiel – bitte durch eigene Daten ersetzen.',
      status:'installment',
      payments:[{id:10011,amount:30,date:'2026-07-15',note:'1. Rate'},{id:10012,amount:30,date:'2026-08-15',note:'2. Rate'}]
    },
    {
      id:1002, name:'Nachzahlung Rundfunkbeitrag', creditor:'Beitragsservice',
      reference:'', totalAmount:55.08, monthlyRate:55.08,
      nextDueDate:'2026-10-01', startDate:'', note:'',
      status:'open', payments:[]
    }
  ],
  expenses: [
    {id:2001, name:'Miete',           category:'Miete',        amount:650,   interval:'monthly',   nextDueDate:'2026-10-01', paymentMethod:'Überweisung', note:'', active:true, paid:false},
    {id:2002, name:'Strom',           category:'Strom',        amount:80,    interval:'monthly',   nextDueDate:'2026-09-15', paymentMethod:'Lastschrift', note:'', active:true, paid:false},
    {id:2003, name:'Internet & Tel.', category:'Internet',     amount:39.99, interval:'monthly',   nextDueDate:'2026-09-20', paymentMethod:'Lastschrift', note:'', active:true, paid:false},
    {id:2004, name:'KFZ-Versicherung',category:'Versicherung', amount:480,   interval:'yearly',    nextDueDate:'2027-01-01', paymentMethod:'Überweisung', note:'', active:true, paid:false},
    {id:2005, name:'Spotify',         category:'Abonnement',   amount:9.99,  interval:'monthly',   nextDueDate:'2026-09-12', paymentMethod:'Kreditkarte', note:'', active:true, paid:false}
  ]
};

/* ── SPEICHER ── */
function load() {
  try {
    const s = JSON.parse(localStorage.getItem('sparbox-state')) || structuredClone(defaults);
    if (!s.fines)    s.fines    = structuredClone(defaults.fines);
    if (!s.expenses) s.expenses = structuredClone(defaults.expenses);
    s.fines.forEach(f => { if (!f.payments) f.payments = []; });
    return s;
  } catch { return structuredClone(defaults); }
}
function save() { localStorage.setItem('sparbox-state', JSON.stringify(state)); }

/* ── ZUSTAND ── */
let state = load();
let modalMode = 'deposit';
let editFineId = null;
let editExpenseId = null;
let payFineId = null;

/* ── HILFSFUNKTIONEN ── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function uid() { return Date.now() + Math.floor(Math.random() * 100000); }
function isOverdue(d) { return d ? new Date(d + 'T23:59:59') < new Date() : false; }
function daysUntil(d) { return d ? Math.ceil((new Date(d + 'T12:00:00') - new Date()) / 86400000) : null; }
function toMonthly(amount, interval) {
  return ({once:0, weekly:amount*4.33, monthly:amount, quarterly:amount/3, yearly:amount/12})[interval] ?? 0;
}
function fmtDate(d) {
  if (!d) return '–';
  try { return dateFmt.format(new Date(d + 'T12:00:00')); } catch { return '–'; }
}
function showToast(msg) {
  const el = document.querySelector('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── SPARBOX-STAND ── */
function balance() {
  return state.transactions.reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0);
}

/* ── STRAFEN-BERECHNUNGEN ── */
function finePaid(f)      { return (f.payments || []).reduce((s, p) => s + Number(p.amount), 0); }
function fineRemaining(f) { return Math.max(0, Number(f.totalAmount) - finePaid(f)); }

/* ── AUSGABEN-BERECHNUNGEN ── */
function totalMonthlyExpenses() {
  return state.expenses
    .filter(e => e.active && e.interval !== 'once')
    .reduce((s, e) => s + toMonthly(Number(e.amount), e.interval), 0);
}

/* ══════════════════════════════════════
   RENDER – ÜBERSICHT
══════════════════════════════════════ */
function render() {
  const b       = balance();
  const target  = Number(state.goal.target) || 1;
  const p       = Math.min(100, Math.max(0, b / target * 100));
  const remaining = Math.max(0, target - b);

  document.querySelector('#balanceValue').textContent  = euro.format(b);
  document.querySelector('#goalPercent').textContent   = Math.round(p) + '%';
  document.querySelector('#goalRing').style.setProperty('--p', p);
  document.querySelector('#goalName').textContent      = state.goal.name;
  document.querySelector('#goalCurrent').textContent   = euro.format(b);
  document.querySelector('#goalTarget').textContent    = euro.format(target);
  document.querySelector('#goalRemaining').textContent = remaining
    ? 'Noch ' + euro.format(remaining) : 'Ziel erreicht!';

  const end    = new Date(state.goal.date + 'T12:00:00');
  const now    = new Date();
  const months = Math.max(1, (end.getFullYear()-now.getFullYear())*12 + end.getMonth()-now.getMonth());
  document.querySelector('#forecastRemaining').textContent = euro.format(remaining);
  document.querySelector('#monthlyNeeded').textContent     = euro.format(remaining / months);
  document.querySelector('#targetDateTitle').textContent   = 'Ziel bis ' + dateFmt.format(end);

  renderRecent();
  renderTable();
  renderGoal();
  renderStatement();
  renderFinancialOverview();
}

/* FINANZÜBERBLICK auf Übersichtsseite */
function renderFinancialOverview() {
  const totalFineDebt    = state.fines.reduce((s,f) => s + fineRemaining(f), 0);
  const totalMonthlyRate = state.fines
    .filter(f => f.status === 'installment')
    .reduce((s,f) => s + Number(f.monthlyRate || 0), 0);
  const monthlyExp = totalMonthlyExpenses();

  const upcoming = [
    ...state.fines.filter(f => f.status !== 'paid' && f.nextDueDate)
      .map(f => ({name:f.name, date:f.nextDueDate})),
    ...state.expenses.filter(e => e.active && !e.paid && e.nextDueDate)
      .map(e => ({name:e.name, date:e.nextDueDate}))
  ].sort((a,b) => a.date.localeCompare(b.date))[0];

  const overdueCount = [
    ...state.fines.filter(f => f.status !== 'paid' && isOverdue(f.nextDueDate)),
    ...state.expenses.filter(e => e.active && !e.paid && isOverdue(e.nextDueDate))
  ].length;

  const el = document.querySelector('#financialOverview');
  if (!el) return;

  const showOverview = totalFineDebt > 0 || monthlyExp > 0 || overdueCount > 0;
  if (!showOverview) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <article class="panel fo-panel">
      <div class="fo-head"><span class="eyebrow">Finanzüberblick</span></div>
      <div class="fo-grid">
        <div class="fo-cell">
          <small>Offene Forderungen</small>
          <strong class="${totalFineDebt > 0 ? 'col-red' : ''}">${euro.format(totalFineDebt)}</strong>
        </div>
        <div class="fo-cell">
          <small>Monatl. Strafraten</small>
          <strong>${euro.format(totalMonthlyRate)}</strong>
        </div>
        <div class="fo-cell">
          <small>Monatl. Ausgaben</small>
          <strong>${euro.format(monthlyExp)}</strong>
        </div>
        <div class="fo-cell">
          <small>Nächste Zahlung</small>
          <strong>${upcoming ? esc(upcoming.name) + '<br><span class="due-small">' + fmtDate(upcoming.date) + '</span>' : '–'}</strong>
        </div>
        ${overdueCount > 0 ? `<div class="fo-cell fo-alert"><small>Überfällig</small><strong class="col-red">${overdueCount}&nbsp;Zahlung${overdueCount !== 1 ? 'en' : ''}</strong></div>` : ''}
      </div>
    </article>`;
}

/* ── BUCHUNGEN ── */
function sorted() {
  return [...state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));
}
function txRow(t) {
  const cls = t.type === 'withdraw' ? 'withdraw' : '';
  return `<div class="transaction-row">
    <div class="transaction-icon ${cls}">${t.type==='deposit'?'↓':'↑'}</div>
    <div class="transaction-copy">
      <strong>${esc(t.note||(t.type==='deposit'?'Einzahlung':'Auszahlung'))}</strong>
      <small>${dateFmt.format(new Date(t.date))}</small>
    </div>
    <span class="amount ${cls}">${t.type==='deposit'?'+':'−'}${euro.format(t.amount)}</span>
  </div>`;
}
function renderRecent() {
  const a = sorted().slice(0,5);
  document.querySelector('#recentTransactions').innerHTML =
    a.length ? a.map(txRow).join('') : '<div class="empty">Noch keine Buchungen.</div>';
}
function balancesById() {
  let s=0, m={};
  [...state.transactions].sort((a,b)=>new Date(a.date)-new Date(b.date))
    .forEach(t => { s += t.type==='deposit'?t.amount:-t.amount; m[t.id]=s; });
  return m;
}
function renderTable() {
  const q  = (document.querySelector('#searchInput')?.value||'').toLowerCase();
  const f  = document.querySelector('#typeFilter')?.value||'all';
  const bm = balancesById();
  const a  = sorted().filter(t => (f==='all'||t.type===f) && (t.note||'').toLowerCase().includes(q));
  document.querySelector('#transactionTable').innerHTML = a.length
    ? a.map(t=>`<tr>
        <td>${dateFmt.format(new Date(t.date))}</td>
        <td>${esc(t.note||'–')}</td>
        <td><span class="type-pill ${t.type==='withdraw'?'withdraw':''}">${t.type==='deposit'?'Einzahlung':'Auszahlung'}</span></td>
        <td class="right amount ${t.type==='withdraw'?'withdraw':''}">${t.type==='deposit'?'+':'−'}${euro.format(t.amount)}</td>
        <td class="right">${euro.format(bm[t.id])}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="empty">Keine passenden Buchungen.</td></tr>';
}

/* ── SPARZIEL ── */
function renderGoal() {
  document.querySelector('#goalNameInput').value   = state.goal.name;
  document.querySelector('#goalAmountInput').value = state.goal.target;
  document.querySelector('#goalDateInput').value   = state.goal.date;
  const b = balance();
  document.querySelector('#milestones').innerHTML = [25,50,75,100].map(x => {
    const val=state.goal.target*x/100, done=b>=val;
    return `<div class="milestone ${done?'done':''}">
      <div class="milestone-badge">${done?'✓':x+'%'}</div>
      <div><strong>${x}% erreicht</strong><small>${euro.format(val)}</small></div>
      <span>${done?'Geschafft':'Offen'}</span>
    </div>`;
  }).join('');
}

/* ── KONTOAUSZUG ── */
function renderStatement() {
  const b   = balance();
  const dep = state.transactions.filter(t=>t.type==='deposit').reduce((s,t)=>s+t.amount,0);
  const wd  = state.transactions.filter(t=>t.type==='withdraw').reduce((s,t)=>s+t.amount,0);
  const bm  = balancesById();
  document.querySelector('#statementPreview').innerHTML = `
    <div class="statement-brand">
      <div><span class="eyebrow">Privater Sparauszug</span><h2>SparBox</h2></div>
      <div>Erstellt am ${dateFmt.format(new Date())}</div>
    </div>
    <h3>${esc(state.goal.name)}</h3>
    <div class="statement-summary">
      <div><small>Einzahlungen</small><strong>${euro.format(dep)}</strong></div>
      <div><small>Auszahlungen</small><strong>${euro.format(wd)}</strong></div>
      <div><small>Endbestand</small><strong>${euro.format(b)}</strong></div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Datum</th><th>Beschreibung</th><th class="right">Betrag</th><th class="right">Stand</th></tr></thead>
    <tbody>${sorted().map(t=>`<tr>
      <td>${dateFmt.format(new Date(t.date))}</td>
      <td>${esc(t.note||'–')}</td>
      <td class="right">${t.type==='deposit'?'+':'−'}${euro.format(t.amount)}</td>
      <td class="right">${euro.format(bm[t.id])}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

/* ══════════════════════════════════════
   MODUL: STRAFEN
══════════════════════════════════════ */
function renderFines() {
  const q          = (document.querySelector('#finesSearch')?.value||'').toLowerCase();
  const statusF    = document.querySelector('#finesFilter')?.value||'all';
  const sortBy     = document.querySelector('#finesSort')?.value||'due';
  const allFines   = state.fines;

  /* Zusammenfassung */
  const totalDebt      = allFines.reduce((s,f)=>s+Number(f.totalAmount),0);
  const totalPaid      = allFines.reduce((s,f)=>s+finePaid(f),0);
  const totalRemaining = allFines.reduce((s,f)=>s+fineRemaining(f),0);
  const totalRate      = allFines.filter(f=>f.status==='installment').reduce((s,f)=>s+Number(f.monthlyRate||0),0);
  const openCount      = allFines.filter(f=>f.status!=='paid').length;
  const overdueCount   = allFines.filter(f=>f.status!=='paid'&&isOverdue(f.nextDueDate)).length;

  const summEl = document.querySelector('#finesSummary');
  if (summEl) summEl.innerHTML = allFines.length ? `
    <div class="summ-card"><small>Gesamtforderung</small><strong>${euro.format(totalDebt)}</strong></div>
    <div class="summ-card"><small>Bereits bezahlt</small><strong class="col-green">${euro.format(totalPaid)}</strong></div>
    <div class="summ-card"><small>Offener Restbetrag</small><strong class="${totalRemaining>0?'col-red':''}">${euro.format(totalRemaining)}</strong></div>
    <div class="summ-card"><small>Monatl. Raten</small><strong>${euro.format(totalRate)}</strong></div>
    <div class="summ-card"><small>Offen / Überfällig</small><strong>${openCount}&thinsp;/&thinsp;<span class="${overdueCount>0?'col-red':''}">${overdueCount}</span></strong></div>
  ` : '';

  /* Filter & Sortierung */
  let fines = allFines.filter(f => {
    const matchQ = !q || f.name.toLowerCase().includes(q) || f.creditor.toLowerCase().includes(q) || (f.reference||'').toLowerCase().includes(q);
    return matchQ && (statusF==='all' || f.status===statusF);
  });
  if (sortBy==='due')       fines.sort((a,b)=>(a.nextDueDate||'9').localeCompare(b.nextDueDate||'9'));
  else if (sortBy==='remaining') fines.sort((a,b)=>fineRemaining(b)-fineRemaining(a));
  else fines.sort((a,b)=>a.name.localeCompare(b.name,'de'));

  const listEl = document.querySelector('#finesList');
  if (!listEl) return;
  listEl.innerHTML = fines.length
    ? fines.map(fineCard).join('')
    : '<div class="empty-state"><p>Keine Strafen gefunden.</p></div>';
}

function fineCard(f) {
  const paid      = finePaid(f);
  const remaining = fineRemaining(f);
  const pct       = f.totalAmount > 0 ? Math.min(100, paid / f.totalAmount * 100) : 0;
  const overdue   = f.status !== 'paid' && isOverdue(f.nextDueDate);
  const days      = f.nextDueDate ? daysUntil(f.nextDueDate) : null;
  const stCls     = {open:'st-open',installment:'st-install',paid:'st-paid',paused:'st-paused'}[f.status]||'';

  let dueLabel = '';
  if (f.nextDueDate && f.status !== 'paid') {
    if (overdue)      dueLabel = 'überfällig!';
    else if (days===0) dueLabel = 'heute';
    else if (days===1) dueLabel = 'morgen';
    else               dueLabel = 'in ' + days + ' Tagen';
  }

  return `<article class="item-card${overdue?' overdue':''}${f.status==='paid'?' is-paid':''}">
    <div class="item-card-head">
      <div>
        <h3 class="item-title">${esc(f.name)}</h3>
        <div class="item-meta">${esc(f.creditor)}${f.reference?' · '+esc(f.reference):''}</div>
      </div>
      <div class="item-badges">
        <span class="st-pill ${stCls}">${STATUS_FINE[f.status]||f.status}</span>
        ${overdue?'<span class="overdue-tag">Überfällig</span>':''}
      </div>
    </div>
    <div class="prog-wrap">
      <div class="prog-bar"><div class="prog-fill" style="width:${pct.toFixed(1)}%"></div></div>
      <span class="prog-label">${Math.round(pct)}%</span>
    </div>
    <div class="item-amounts">
      <div><small>Gesamt</small><strong>${euro.format(f.totalAmount)}</strong></div>
      <div><small>Bezahlt</small><strong class="col-green">${euro.format(paid)}</strong></div>
      <div><small>Restbetrag</small><strong class="${remaining>0?'col-red':''}">${euro.format(remaining)}</strong></div>
      ${f.monthlyRate?`<div><small>Rate/Monat</small><strong>${euro.format(f.monthlyRate)}</strong></div>`:''}
    </div>
    ${f.nextDueDate && f.status!=='paid' ? `<div class="item-due${overdue?' col-red':''}">
      Nächste Zahlung: <strong>${fmtDate(f.nextDueDate)}</strong>
      ${dueLabel?`<span class="days-tag${overdue?' overdue-tag':days<=7?' soon-tag':''}">${dueLabel}</span>`:''}
    </div>` : ''}
    ${f.note?`<p class="item-note">${esc(f.note)}</p>`:''}
    <div class="item-actions">
      ${f.status!=='paid'?`<button class="secondary btn-sm" onclick="openPayFine(${f.id})">Zahlung erfassen</button>`:''}
      <button class="secondary btn-sm" onclick="openEditFine(${f.id})">Bearbeiten</button>
      <button class="secondary btn-sm danger" onclick="deleteFine(${f.id})">Löschen</button>
      ${f.payments&&f.payments.length?`<button class="text-button btn-sm" onclick="togglePayments(${f.id})">Zahlungsverlauf</button>`:''}
    </div>
    <div class="payment-history" id="ph-${f.id}" hidden>
      ${(f.payments||[]).map(p=>`<div class="payment-row">
        <span>${fmtDate(p.date)}</span><span>${esc(p.note||'–')}</span>
        <strong class="col-green">+${euro.format(p.amount)}</strong>
      </div>`).join('')}
    </div>
  </article>`;
}

function togglePayments(id) {
  const el = document.querySelector('#ph-' + id);
  if (el) el.hidden = !el.hidden;
}

function openAddFine() {
  editFineId = null;
  document.querySelector('#formModalEyebrow').textContent = 'Neue Strafe';
  document.querySelector('#formModalTitle').textContent   = 'Strafe erfassen';
  document.querySelector('#fineForm').reset();
  document.querySelector('#fineStatus').value = 'open';
  showFormModal('fineForm');
}

function openEditFine(id) {
  editFineId = id;
  const f = state.fines.find(x => x.id === id);
  if (!f) return;
  document.querySelector('#formModalEyebrow').textContent = 'Strafe bearbeiten';
  document.querySelector('#formModalTitle').textContent   = f.name;
  document.querySelector('#fineName').value        = f.name;
  document.querySelector('#fineCreditor').value    = f.creditor;
  document.querySelector('#fineReference').value   = f.reference||'';
  document.querySelector('#fineStatus').value      = f.status;
  document.querySelector('#fineTotalAmount').value = f.totalAmount;
  document.querySelector('#fineMonthlyRate').value = f.monthlyRate||'';
  document.querySelector('#fineNextDue').value     = f.nextDueDate||'';
  document.querySelector('#fineStartDate').value   = f.startDate||'';
  document.querySelector('#fineNote').value        = f.note||'';
  showFormModal('fineForm');
}

function openPayFine(id) {
  payFineId = id;
  const f = state.fines.find(x => x.id === id);
  if (!f) return;
  document.querySelector('#formModalEyebrow').textContent = 'Zahlung erfassen';
  document.querySelector('#formModalTitle').textContent   = f.name;
  document.querySelector('#finePaymentForm').reset();
  document.querySelector('#finePaymentDate').value   = new Date().toISOString().slice(0,10);
  if (f.monthlyRate) document.querySelector('#finePaymentAmount').value = f.monthlyRate;
  showFormModal('finePaymentForm');
}

function deleteFine(id) {
  const f = state.fines.find(x => x.id === id);
  if (!f) return;
  if (!confirm('Strafe „' + f.name + '" wirklich löschen?')) return;
  state.fines = state.fines.filter(x => x.id !== id);
  save(); renderFines(); render();
  showToast('Strafe gelöscht.');
}

/* ══════════════════════════════════════
   MODUL: AUSGABEN
══════════════════════════════════════ */
function renderExpenses() {
  const q       = (document.querySelector('#expensesSearch')?.value||'').toLowerCase();
  const catF    = document.querySelector('#expensesCategoryFilter')?.value||'all';
  const intF    = document.querySelector('#expensesIntervalFilter')?.value||'all';
  const statF   = document.querySelector('#expensesStatusFilter')?.value||'all';
  const allExp  = state.expenses;

  const monthlyTotal = totalMonthlyExpenses();
  const paidActive   = allExp.filter(e=>e.paid&&e.active).reduce((s,e)=>s+Number(e.amount),0);
  const openCount    = allExp.filter(e=>e.active&&!e.paid).length;
  const nextDueExp   = allExp.filter(e=>e.active&&!e.paid&&e.nextDueDate)
                             .sort((a,b)=>a.nextDueDate.localeCompare(b.nextDueDate))[0];

  const byCat = {};
  allExp.filter(e=>e.active&&e.interval!=='once').forEach(e=>{
    const k = e.category;
    byCat[k] = (byCat[k]||0) + toMonthly(Number(e.amount), e.interval);
  });

  const summEl = document.querySelector('#expensesSummary');
  if (summEl) summEl.innerHTML = allExp.length ? `
    <div class="summ-card"><small>Monatl. Ausgaben</small><strong>${euro.format(monthlyTotal)}</strong></div>
    <div class="summ-card"><small>Bezahlt (aktiv)</small><strong class="col-green">${euro.format(paidActive)}</strong></div>
    <div class="summ-card"><small>Noch offen</small><strong>${openCount}</strong></div>
    <div class="summ-card"><small>Nächste Fälligkeit</small><strong>${nextDueExp
      ? esc(nextDueExp.name)+'<br><span class="due-small">'+fmtDate(nextDueExp.nextDueDate)+'</span>'
      : '–'}</strong></div>
    <div class="summ-card"><small>Kategorien (mtl.)</small><div class="cat-dist">${
      Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5)
        .map(([k,v])=>`<span class="cat-pill">${esc(k)}: ${euro.format(v)}</span>`).join('')
    }</div></div>
  ` : '';

  let expenses = allExp.filter(e => {
    const mQ   = !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
    const mCat = catF==='all' || e.category===catF;
    const mInt = intF==='all' || e.interval===intF;
    let   mSt  = true;
    if (statF==='active')  mSt = e.active && !e.paid;
    if (statF==='paused')  mSt = !e.active;
    if (statF==='overdue') mSt = e.active && !e.paid && isOverdue(e.nextDueDate);
    return mQ && mCat && mInt && mSt;
  }).sort((a,b)=>(a.nextDueDate||'9').localeCompare(b.nextDueDate||'9'));

  const listEl = document.querySelector('#expensesList');
  if (!listEl) return;
  listEl.innerHTML = expenses.length
    ? expenses.map(expenseCard).join('')
    : '<div class="empty-state"><p>Keine Ausgaben gefunden.</p></div>';
}

function expenseCard(e) {
  const overdue  = e.active && !e.paid && isOverdue(e.nextDueDate);
  const days     = e.nextDueDate ? daysUntil(e.nextDueDate) : null;
  const monthly  = toMonthly(Number(e.amount), e.interval);

  let dueLabel = '';
  if (e.nextDueDate && !e.paid) {
    if (overdue)       dueLabel = 'überfällig!';
    else if (days===0) dueLabel = 'heute';
    else if (days===1) dueLabel = 'morgen';
    else if (days!==null) dueLabel = 'in ' + days + ' Tagen';
  }

  return `<article class="item-card${overdue?' overdue':''}${!e.active?' is-paused':''}${e.paid?' is-paid':''}">
    <div class="item-card-head">
      <div>
        <h3 class="item-title">${esc(e.name)}</h3>
        <div class="item-meta">
          <span class="cat-pill">${esc(e.category)}</span>
          <span class="int-pill">${INTERVAL_LABEL[e.interval]||e.interval}</span>
        </div>
      </div>
      <div class="item-badges">
        ${!e.active
          ? '<span class="st-pill st-paused">Pausiert</span>'
          : e.paid
            ? '<span class="st-pill st-paid">Bezahlt</span>'
            : overdue
              ? '<span class="overdue-tag">Überfällig</span>'
              : '<span class="st-pill st-open">Aktiv</span>'}
      </div>
    </div>
    <div class="item-amounts">
      <div><small>Betrag</small><strong>${euro.format(e.amount)}</strong></div>
      ${e.interval!=='once'?`<div><small>Pro Monat</small><strong>${euro.format(monthly)}</strong></div>`:''}
      ${e.paymentMethod?`<div><small>Zahlungsweg</small><strong>${esc(e.paymentMethod)}</strong></div>`:''}
    </div>
    ${e.nextDueDate?`<div class="item-due${overdue?' col-red':''}">
      ${e.interval==='once'?'Fälligkeit':'Nächste Fälligkeit'}: <strong>${fmtDate(e.nextDueDate)}</strong>
      ${dueLabel&&!e.paid?`<span class="days-tag${overdue?' overdue-tag':days<=7?' soon-tag':''}">${dueLabel}</span>`:''}
    </div>`:''}
    ${e.note?`<p class="item-note">${esc(e.note)}</p>`:''}
    <div class="item-actions">
      ${e.active&&!e.paid?`<button class="secondary btn-sm" onclick="markExpensePaid(${e.id})">Als bezahlt markieren</button>`:''}
      ${e.paid?`<button class="secondary btn-sm" onclick="markExpenseUnpaid(${e.id})">Als offen markieren</button>`:''}
      ${e.interval!=='once'?`<button class="secondary btn-sm" onclick="toggleExpenseActive(${e.id})">${e.active?'Pausieren':'Aktivieren'}</button>`:''}
      <button class="secondary btn-sm" onclick="openEditExpense(${e.id})">Bearbeiten</button>
      <button class="secondary btn-sm danger" onclick="deleteExpense(${e.id})">Löschen</button>
    </div>
  </article>`;
}

function openAddExpense() {
  editExpenseId = null;
  document.querySelector('#formModalEyebrow').textContent = 'Neue Ausgabe';
  document.querySelector('#formModalTitle').textContent   = 'Ausgabe erfassen';
  document.querySelector('#expenseForm').reset();
  document.querySelector('#expenseInterval').value  = 'monthly';
  document.querySelector('#expenseCategory').value  = 'Sonstiges';
  document.querySelector('#expenseNextDue').value   = new Date().toISOString().slice(0,10);
  showFormModal('expenseForm');
}

function openEditExpense(id) {
  editExpenseId = id;
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  document.querySelector('#formModalEyebrow').textContent  = 'Ausgabe bearbeiten';
  document.querySelector('#formModalTitle').textContent    = e.name;
  document.querySelector('#expenseName').value          = e.name;
  document.querySelector('#expenseCategory').value      = e.category;
  document.querySelector('#expenseAmount').value        = e.amount;
  document.querySelector('#expenseInterval').value      = e.interval;
  document.querySelector('#expenseNextDue').value       = e.nextDueDate||'';
  document.querySelector('#expensePaymentMethod').value = e.paymentMethod||'';
  document.querySelector('#expenseNote').value          = e.note||'';
  showFormModal('expenseForm');
}

function markExpensePaid(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  e.paid = true;
  save(); renderExpenses(); render();
  showToast('Als bezahlt markiert.');
}
function markExpenseUnpaid(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  e.paid = false;
  save(); renderExpenses();
  showToast('Als offen markiert.');
}
function toggleExpenseActive(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  e.active = !e.active;
  save(); renderExpenses(); render();
  showToast(e.active ? 'Ausgabe aktiviert.' : 'Ausgabe pausiert.');
}
function deleteExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  if (!confirm('Ausgabe „' + e.name + '" wirklich löschen?')) return;
  state.expenses = state.expenses.filter(x => x.id !== id);
  save(); renderExpenses(); render();
  showToast('Ausgabe gelöscht.');
}

/* ══════════════════════════════════════
   FORM-MODAL (Strafen / Ausgaben)
══════════════════════════════════════ */
function showFormModal(formId) {
  ['fineForm','finePaymentForm','expenseForm'].forEach(id => {
    document.querySelector('#'+id).hidden = (id !== formId);
  });
  document.querySelector('#formBackdrop').hidden = false;
  setTimeout(() => {
    const first = document.querySelector('#formBackdrop form:not([hidden]) input, #formBackdrop form:not([hidden]) select');
    if (first) first.focus();
  }, 60);
}
function closeFormModal() {
  document.querySelector('#formBackdrop').hidden = true;
  editFineId = editExpenseId = payFineId = null;
}

/* ══════════════════════════════════════
   ANSICHT WECHSELN
══════════════════════════════════════ */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id==='view-'+name));
  document.querySelectorAll('.nav-item').forEach(v => v.classList.toggle('active', v.dataset.view===name));
  document.querySelector('#viewTitle').textContent = VIEWS[name]||name;
  document.querySelector('.sidebar').classList.remove('open');
  if (name==='fines')    renderFines();
  if (name==='expenses') renderExpenses();
}

/* ══════════════════════════════════════
   EINFACHES MODAL (Buchung / Öffnung)
══════════════════════════════════════ */
function openModal(mode) {
  modalMode = mode;
  const tx = mode !== 'unlock';
  document.querySelector('#transactionForm').hidden = !tx;
  document.querySelector('#unlockForm').hidden      = tx;
  document.querySelector('#modalEyebrow').textContent = mode==='unlock'?'Sicherheit':'Neue Buchung';
  document.querySelector('#modalTitle').textContent   =
    mode==='deposit'?'Einzahlung hinzufügen':mode==='withdraw'?'Auszahlung erfassen':'SparBox öffnen';
  document.querySelector('#modalHint').textContent =
    mode==='deposit'?'Trage den Betrag ein, den du in die Box gelegt hast.':
    mode==='withdraw'?'Der Betrag wird vom aktuellen Sparstand abgezogen.':
    'Gib deinen sechsstelligen Öffnungs-PIN ein.';
  document.querySelector('#transactionSubmit').textContent =
    mode==='deposit'?'Einzahlung speichern':'Auszahlung speichern';
  document.querySelector('#modalBackdrop').hidden = false;
  setTimeout(() => document.querySelector(tx?'#amountInput':'#unlockPin').focus(), 60);
}
function closeModal() {
  document.querySelector('#modalBackdrop').hidden = true;
  document.querySelector('#transactionForm').reset();
  document.querySelector('#unlockForm').reset();
}

/* ══════════════════════════════════════
   PDF-ERZEUGUNG
══════════════════════════════════════ */
function pdfEsc(s) {
  return String(s==null?'':s)
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
    .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue')
    .replace(/ß/g,'ss').replace(/€/g,'EUR')
    .replace(/[^\x20-\x7E]/g,'?')
    .replace(/([\\()])/g,'\\$1');
}
function buildPdf(lines) {
  let content = 'BT /F1 10 Tf 50 820 Td ';
  lines.forEach((l,i)=>{ content += (i?'0 -15 Td ':'')+'('+pdfEsc(l)+') Tj '; });
  content += 'ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'
  ];
  let pdf='%PDF-1.4\n', offs=[0];
  objs.forEach((o,i)=>{ offs.push(pdf.length); pdf+=`${i+1} 0 obj\n${o}\nendobj\n`; });
  const x=pdf.length;
  pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  offs.slice(1).forEach(o=>pdf+=String(o).padStart(10,'0')+' 00000 n \n');
  pdf+=`trailer << /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return pdf;
}
function dlPdf(content, name) {
  const url=URL.createObjectURL(new Blob([content],{type:'application/pdf'}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function makePdf() {
  const lines=['SparBox - Kontoauszug','Sparziel: '+state.goal.name,
    'Erstellt: '+dateFmt.format(new Date()),'Aktueller Stand: '+euro.format(balance()),'',
    'Datum       Beschreibung                         Betrag'];
  sorted().forEach(t=>lines.push(
    dateFmt.format(new Date(t.date))+'   '+
    (t.note||'Buchung').slice(0,32).padEnd(34)+
    (t.type==='deposit'?'+':'-')+t.amount.toFixed(2)+' EUR'));
  dlPdf(buildPdf(lines),'SparBox-Kontoauszug-'+new Date().toISOString().slice(0,10)+'.pdf');
}
function makeFinesPdf() {
  const lines=['SparBox - Strafenuebersicht','Erstellt: '+dateFmt.format(new Date()),'',
    'Gesamtforderung: '+state.fines.reduce((s,f)=>s+Number(f.totalAmount),0).toFixed(2)+' EUR',
    'Bereits bezahlt: '+state.fines.reduce((s,f)=>s+finePaid(f),0).toFixed(2)+' EUR',
    'Offener Restbetrag: '+state.fines.reduce((s,f)=>s+fineRemaining(f),0).toFixed(2)+' EUR','',
    'Name                           Glaeubiger          Gesamt   Bezahlt  Rest     Status'];
  state.fines.forEach(f=>{
    lines.push(
      f.name.slice(0,30).padEnd(31)+
      f.creditor.slice(0,18).padEnd(19)+
      f.totalAmount.toFixed(2).padStart(8)+' '+
      finePaid(f).toFixed(2).padStart(8)+' '+
      fineRemaining(f).toFixed(2).padStart(8)+' '+
      (STATUS_FINE[f.status]||f.status));
    if (f.nextDueDate&&f.status!=='paid')
      lines.push('  Naechste Zahlung: '+fmtDate(f.nextDueDate)+(f.monthlyRate?'  Rate: '+Number(f.monthlyRate).toFixed(2)+' EUR':''));
    (f.payments||[]).forEach(p=>
      lines.push('  > '+fmtDate(p.date)+'  '+(p.note||'').slice(0,20).padEnd(22)+p.amount.toFixed(2)+' EUR'));
  });
  dlPdf(buildPdf(lines),'SparBox-Strafen-'+new Date().toISOString().slice(0,10)+'.pdf');
}
function makeExpensesPdf() {
  const lines=['SparBox - Ausgabenuebersicht','Erstellt: '+dateFmt.format(new Date()),
    'Geschaetzte Monatsausgaben: '+totalMonthlyExpenses().toFixed(2)+' EUR','',
    'Name                           Kategorie    Betrag   Intervall     Faellig'];
  state.expenses
    .sort((a,b)=>(a.nextDueDate||'').localeCompare(b.nextDueDate||''))
    .forEach(e=>lines.push(
      e.name.slice(0,30).padEnd(31)+
      e.category.slice(0,12).padEnd(13)+
      Number(e.amount).toFixed(2).padStart(8)+' '+
      (INTERVAL_LABEL[e.interval]||e.interval).slice(0,13).padEnd(14)+
      fmtDate(e.nextDueDate)));
  dlPdf(buildPdf(lines),'SparBox-Ausgaben-'+new Date().toISOString().slice(0,10)+'.pdf');
}

/* ══════════════════════════════════════
   EVENT LISTENER
══════════════════════════════════════ */
/* Navigation */
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
document.querySelectorAll('[data-view-jump]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.viewJump)));
document.querySelector('#menuBtn').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));

/* Einfaches Modal */
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.open)));
document.querySelector('#modalClose').addEventListener('click',closeModal);
document.querySelector('#modalBackdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
document.querySelectorAll('[data-amount]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('#amountInput').value=b.dataset.amount;}));

/* Form-Modal */
document.querySelector('#formModalClose').addEventListener('click',closeFormModal);
document.querySelector('#formBackdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeFormModal();});
document.querySelector('#fineCancelBtn').addEventListener('click',closeFormModal);
document.querySelector('#finePaymentCancelBtn').addEventListener('click',closeFormModal);
document.querySelector('#expenseCancelBtn').addEventListener('click',closeFormModal);

/* Escape-Taste */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeFormModal();}
});

/* Modul-Buttons */
document.querySelector('#addFineBtn').addEventListener('click',openAddFine);
document.querySelector('#addExpenseBtn').addEventListener('click',openAddExpense);

/* Suchfelder */
document.querySelector('#searchInput').addEventListener('input',renderTable);
document.querySelector('#typeFilter').addEventListener('change',renderTable);
document.querySelector('#finesSearch').addEventListener('input',renderFines);
document.querySelector('#finesFilter').addEventListener('change',renderFines);
document.querySelector('#finesSort').addEventListener('change',renderFines);
document.querySelector('#expensesSearch').addEventListener('input',renderExpenses);
document.querySelector('#expensesCategoryFilter').addEventListener('change',renderExpenses);
document.querySelector('#expensesIntervalFilter').addEventListener('change',renderExpenses);
document.querySelector('#expensesStatusFilter').addEventListener('change',renderExpenses);

/* Formulare */
document.querySelector('#transactionForm').addEventListener('submit',e=>{
  e.preventDefault();
  const amount=Number(document.querySelector('#amountInput').value);
  if(!amount)return;
  if(modalMode==='withdraw'&&amount>balance()){showToast('Auszahlung ist höher als der Sparstand.');return;}
  state.transactions.push({id:uid(),type:modalMode,amount,
    note:document.querySelector('#noteInput').value.trim()||(modalMode==='deposit'?'Einzahlung':'Auszahlung'),
    date:new Date().toISOString()});
  save();render();closeModal();
  showToast((modalMode==='deposit'?'Einzahlung':'Auszahlung')+' gespeichert.');
});

document.querySelector('#unlockForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(document.querySelector('#unlockPin').value===state.pin){closeModal();showToast('PIN korrekt – Öffnung wurde simuliert.');}
  else showToast('PIN ist nicht korrekt.');
});

document.querySelector('#goalForm').addEventListener('submit',e=>{
  e.preventDefault();
  state.goal={name:document.querySelector('#goalNameInput').value.trim(),
    target:Number(document.querySelector('#goalAmountInput').value),
    date:document.querySelector('#goalDateInput').value};
  save();render();showToast('Sparziel gespeichert.');
});

document.querySelector('#pinForm').addEventListener('submit',e=>{
  e.preventDefault();
  const a=document.querySelector('#pinInput').value, b=document.querySelector('#pinConfirm').value;
  if(!/^\d{6}$/.test(a)){showToast('Der PIN muss aus sechs Zahlen bestehen.');return;}
  if(a!==b){showToast('Die PIN-Eingaben stimmen nicht überein.');return;}
  state.pin=a;save();e.target.reset();showToast('PIN wurde geändert.');
});

document.querySelector('#fineForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=document.querySelector('#fineName').value.trim();
  const creditor=document.querySelector('#fineCreditor').value.trim();
  if(!name||!creditor){showToast('Bitte Bezeichnung und Gläubiger ausfüllen.');return;}
  const data={
    name, creditor,
    reference:document.querySelector('#fineReference').value.trim(),
    status:document.querySelector('#fineStatus').value,
    totalAmount:Number(document.querySelector('#fineTotalAmount').value),
    monthlyRate:Number(document.querySelector('#fineMonthlyRate').value)||0,
    nextDueDate:document.querySelector('#fineNextDue').value,
    startDate:document.querySelector('#fineStartDate').value,
    note:document.querySelector('#fineNote').value.trim()
  };
  if(editFineId){
    const f=state.fines.find(x=>x.id===editFineId);
    if(f)Object.assign(f,data);
    showToast('Strafe gespeichert.');
  } else {
    state.fines.push({id:uid(),payments:[],...data});
    showToast('Strafe erfasst.');
  }
  save();renderFines();render();closeFormModal();
});

document.querySelector('#finePaymentForm').addEventListener('submit',e=>{
  e.preventDefault();
  const f=state.fines.find(x=>x.id===payFineId);
  if(!f)return;
  const amount=Number(document.querySelector('#finePaymentAmount').value);
  const date=document.querySelector('#finePaymentDate').value;
  const note=document.querySelector('#finePaymentNote').value.trim();
  if(!f.payments)f.payments=[];
  f.payments.push({id:uid(),amount,date,note});
  if(fineRemaining(f)<=0){f.status='paid';showToast('Zahlung erfasst – Strafe vollständig bezahlt!');}
  else showToast('Zahlung von '+euro.format(amount)+' erfasst.');
  save();renderFines();render();closeFormModal();
});

document.querySelector('#expenseForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=document.querySelector('#expenseName').value.trim();
  if(!name){showToast('Bitte eine Bezeichnung eingeben.');return;}
  const data={
    name,
    category:document.querySelector('#expenseCategory').value,
    amount:Number(document.querySelector('#expenseAmount').value),
    interval:document.querySelector('#expenseInterval').value,
    nextDueDate:document.querySelector('#expenseNextDue').value,
    paymentMethod:document.querySelector('#expensePaymentMethod').value.trim(),
    note:document.querySelector('#expenseNote').value.trim()
  };
  if(editExpenseId){
    const ex=state.expenses.find(x=>x.id===editExpenseId);
    if(ex)Object.assign(ex,data);
    showToast('Ausgabe gespeichert.');
  } else {
    state.expenses.push({id:uid(),active:true,paid:false,...data});
    showToast('Ausgabe erfasst.');
  }
  save();renderExpenses();render();closeFormModal();
});

document.querySelector('#resetData').addEventListener('click',()=>{
  if(confirm('Alle lokalen Testdaten wirklich zurücksetzen?')){
    state=structuredClone(defaults);save();render();renderFines();renderExpenses();
    showToast('Testdaten wurden zurückgesetzt.');
  }
});

/* PDF */
document.querySelector('#downloadPdf').addEventListener('click',makePdf);
document.querySelector('#downloadFinesPdf').addEventListener('click',makeFinesPdf);
document.querySelector('#downloadExpensesPdf').addEventListener('click',makeExpensesPdf);

/* ── UHR ── */
function tick() {
  const n=new Date();
  document.querySelector('#clockTime').textContent=n.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  document.querySelector('#clockDate').textContent=dateFmt.format(n);
  document.querySelector('#todayLabel').textContent=n.toLocaleDateString('de-DE',{weekday:'long'});
}
tick();setInterval(tick,1000);
render();
