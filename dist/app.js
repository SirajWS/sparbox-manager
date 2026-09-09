/* SparBox Manager v3 – Mehrere Sparziele, vollständige Datenverwaltung */
'use strict';

/* ── KONSTANTEN ── */
const euro    = new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR'});
const dateFmt = new Intl.DateTimeFormat('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});

const VIEWS = {
  overview:'Übersicht', transactions:'Buchungen', goal:'Sparziele',
  fines:'Strafen', expenses:'Ausgaben', statement:'Kontoauszug', settings:'Einstellungen'
};
const STATUS_FINE    = {open:'Offen', installment:'Ratenzahlung', paid:'Bezahlt', paused:'Pausiert'};
const STATUS_GOAL    = {active:'Aktiv', paused:'Pausiert', reached:'Erreicht', archived:'Archiviert'};
const INTERVAL_LABEL = {once:'Einmalig', weekly:'Wöchentlich', monthly:'Monatlich', quarterly:'Vierteljährlich', yearly:'Jährlich'};

/* ── MIGRATION ── */
const MIGRATION_V = 3;

/* Original-Demodaten zur sicheren Erkennung */
const DEMO_TX = {
  1:{note:'Startbetrag',    amount:50,  type:'deposit'},
  2:{note:'Wochenbudget',   amount:20,  type:'deposit'},
  3:{note:'Bargeld gespart',amount:10,  type:'deposit'},
  4:{note:'Kleingeld',      amount:5,   type:'deposit'},
  5:{note:'Einzahlung',     amount:20,  type:'deposit'}
};
const DEMO_FINE_IDS    = [1001, 1002];
const DEMO_EXPENSE_IDS = [2001, 2002, 2003, 2004, 2005];

function isUnmodifiedDemoTx(t) {
  const d = DEMO_TX[t.id];
  return d && d.note === t.note && d.amount === t.amount && d.type === t.type;
}

function migrate(raw) {
  const mv = parseInt(localStorage.getItem('sparbox-mv') || '0');

  /* Schritt 1: altes goals-Objekt → goals-Array */
  if (!raw.goals) {
    if (raw.goal) {
      const isDemo = raw.goal.name === 'Notreserve'
        && Number(raw.goal.target) === 1000
        && raw.goal.date === '2026-12-31';
      if (isDemo) {
        raw.goals       = [];
        raw.primaryGoalId = null;
      } else {
        const gid = uid();
        raw.goals       = [{
          id: gid, name: raw.goal.name || 'Mein Sparziel',
          description: '', target: Number(raw.goal.target) || 1000,
          date: raw.goal.date || '', createdAt: new Date().toISOString().slice(0,10),
          color: '#1f8f61', icon: '◎', status: 'active'
        }];
        raw.primaryGoalId = gid;
      }
    } else {
      raw.goals         = [];
      raw.primaryGoalId = null;
    }
    delete raw.goal;
  }

  /* Schritt 2: Demo-Daten entfernen (nur eindeutig unveränderte) */
  if (mv < MIGRATION_V) {
    if (raw.transactions) {
      raw.transactions = raw.transactions.filter(t => !isUnmodifiedDemoTx(t));
    }
    if (raw.fines) {
      raw.fines = raw.fines.filter(f => {
        if (f.id === 1001) return f.name !== 'Bußgeld Tempoverstoß';
        if (f.id === 1002) return f.name !== 'Nachzahlung Rundfunkbeitrag';
        return true;
      });
    }
    if (raw.expenses) {
      raw.expenses = raw.expenses.filter(e => !DEMO_EXPENSE_IDS.includes(e.id));
    }
    localStorage.setItem('sparbox-mv', String(MIGRATION_V));
  }

  /* Schritt 3: Fehlende Felder ergänzen */
  if (!raw.transactions) raw.transactions = [];
  if (!raw.fines)        raw.fines        = [];
  if (!raw.expenses)     raw.expenses     = [];
  if (!raw.pin)          raw.pin          = '258014';
  raw.fines.forEach(f => { if (!f.payments) f.payments = []; });

  /* Schritt 4: primaryGoalId validieren */
  if (raw.primaryGoalId && !raw.goals.find(g => g.id === raw.primaryGoalId)) {
    raw.primaryGoalId = null;
  }

  return raw;
}

/* ── LEERSTART-DEFAULTS ── */
const defaults = {
  goals: [], primaryGoalId: null, pin: '258014',
  transactions: [], fines: [], expenses: []
};

/* ── SPEICHER ── */
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem('sparbox-state')) || structuredClone(defaults);
    return migrate(raw);
  } catch { return structuredClone(defaults); }
}
function save() { localStorage.setItem('sparbox-state', JSON.stringify(state)); }

/* ── ZUSTAND ── */
let state = load();
let modalMode    = 'deposit';
let editGoalId   = null;
let editFineId   = null;
let editExpenseId= null;
let payFineId    = null;

/* ── HILFSFUNKTIONEN ── */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function uid()       { return Date.now() + Math.floor(Math.random() * 100000); }
function isOverdue(d){ return d ? new Date(d + 'T23:59:59') < new Date() : false; }
function daysUntil(d){ return d ? Math.ceil((new Date(d+'T12:00:00') - new Date()) / 86400000) : null; }
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
  showToast._t = setTimeout(() => el.classList.remove('show'), 3000);
}
function daysTag(d, paid) {
  if (!d || paid) return '';
  const overdue = isOverdue(d);
  const days    = daysUntil(d);
  let label = '';
  if (overdue)       label = 'überfällig!';
  else if (days===0) label = 'heute';
  else if (days===1) label = 'morgen';
  else if (days!==null) label = 'in ' + days + ' Tagen';
  if (!label) return '';
  const cls = overdue ? 'overdue-tag' : days <= 7 ? 'soon-tag' : 'days-tag';
  return `<span class="${cls}">${label}</span>`;
}

/* ── BERECHNUNGEN ── */
function balance() {
  return state.transactions.reduce((s,t) => s + (t.type==='deposit' ? t.amount : -t.amount), 0);
}
function goalBalance(goalId) {
  return state.transactions
    .filter(t => t.goalId === goalId)
    .reduce((s,t) => s + (t.type==='deposit' ? t.amount : -t.amount), 0);
}
function getPrimaryGoal() {
  if (state.primaryGoalId) {
    const g = state.goals.find(x => x.id === state.primaryGoalId && x.status !== 'archived');
    if (g) return g;
  }
  return state.goals.find(g => g.status === 'active') || null;
}
function finePaid(f)      { return (f.payments||[]).reduce((s,p) => s + Number(p.amount), 0); }
function fineRemaining(f) { return Math.max(0, Number(f.totalAmount) - finePaid(f)); }
function totalMonthlyExpenses() {
  return state.expenses
    .filter(e => e.active && e.interval !== 'once')
    .reduce((s,e) => s + toMonthly(Number(e.amount), e.interval), 0);
}
function advanceDueDate(e) {
  if (!e.nextDueDate) return;
  const d = new Date(e.nextDueDate + 'T12:00:00');
  if (e.interval === 'weekly')    d.setDate(d.getDate() + 7);
  if (e.interval === 'monthly')   d.setMonth(d.getMonth() + 1);
  if (e.interval === 'quarterly') d.setMonth(d.getMonth() + 3);
  if (e.interval === 'yearly')    d.setFullYear(d.getFullYear() + 1);
  e.nextDueDate = d.toISOString().slice(0, 10);
}

/* ══════════════════════════════════════
   RENDER ÜBERSICHT
══════════════════════════════════════ */
function render() {
  const totalBal = balance();
  document.querySelector('#balanceValue').textContent = euro.format(totalBal);
  renderPrimaryGoalCard(totalBal);
  renderFinancialOverview();
  renderActiveGoalsPreview();
  renderRecent();
  renderTable();
  renderStatement();
  populateGoalSelect();
  populateGoalFilter();
  if (document.querySelector('#view-goal')?.classList.contains('active')) renderGoals();
}

/* Primäres Sparziel auf Übersichtsseite */
function renderPrimaryGoalCard(totalBal) {
  const card = document.querySelector('#primaryGoalCard');
  if (!card) return;

  const g = getPrimaryGoal();

  if (!g) {
    card.innerHTML = `
      <div class="goal-empty-state">
        <span class="eyebrow">Mein Sparziel</span>
        <p>Noch kein Sparziel vorhanden.</p>
        <button class="primary" onclick="switchView('goal')">Sparziel erstellen</button>
      </div>`;
    const fp = document.querySelector('#forecastPanel');
    if (fp) fp.style.display = 'none';
    return;
  }

  const fp = document.querySelector('#forecastPanel');
  if (fp) fp.style.display = '';

  const gb        = Math.max(0, goalBalance(g.id));
  const target    = Number(g.target) || 1;
  const p         = Math.min(100, gb / target * 100);
  const remaining = Math.max(0, target - gb);
  const end       = new Date(g.date + 'T12:00:00');
  const now       = new Date();
  const months    = Math.max(1, (end.getFullYear()-now.getFullYear())*12 + end.getMonth()-now.getMonth());
  const isPrimary = state.primaryGoalId === g.id;

  card.innerHTML = `
    <div class="goal-ring" style="--p:${p}" aria-label="${Math.round(p)}% erreicht">
      <div>
        <strong>${Math.round(p)}%</strong>
        <span>erreicht</span>
      </div>
    </div>
    <div class="goal-copy">
      <span class="eyebrow">${isPrimary ? 'Hauptziel' : 'Sparziel'}</span>
      <h2 style="color:${esc(g.color||'#142033')}">${esc(g.icon||'')} ${esc(g.name)}</h2>
      <p><strong>${euro.format(gb)}</strong> von <span>${euro.format(target)}</span></p>
      <small>${remaining ? 'Noch ' + euro.format(remaining) : 'Ziel erreicht!'}</small>
      <button class="text-button" onclick="switchView('goal')">Alle Sparziele →</button>
    </div>`;

  /* Forecast Panel befüllen */
  const remEl  = document.querySelector('#forecastRemaining');
  const mnEl   = document.querySelector('#monthlyNeeded');
  const ttEl   = document.querySelector('#targetDateTitle');
  if (remEl) remEl.textContent = euro.format(remaining);
  if (mnEl)  mnEl.textContent  = euro.format(remaining / months);
  if (ttEl)  ttEl.textContent  = 'Ziel bis ' + fmtDate(g.date);
}

/* Finanzüberblick */
function renderFinancialOverview() {
  const totalFineDebt    = state.fines.reduce((s,f) => s + fineRemaining(f), 0);
  const totalMonthlyRate = state.fines.filter(f=>f.status==='installment')
    .reduce((s,f) => s + Number(f.monthlyRate||0), 0);
  const monthlyExp  = totalMonthlyExpenses();
  const upcoming    = [
    ...state.fines.filter(f=>f.status!=='paid'&&f.nextDueDate).map(f=>({name:f.name,date:f.nextDueDate})),
    ...state.expenses.filter(e=>e.active&&!e.paid&&e.nextDueDate).map(e=>({name:e.name,date:e.nextDueDate}))
  ].sort((a,b)=>a.date.localeCompare(b.date))[0];
  const overdueCount = [
    ...state.fines.filter(f=>f.status!=='paid'&&isOverdue(f.nextDueDate)),
    ...state.expenses.filter(e=>e.active&&!e.paid&&isOverdue(e.nextDueDate))
  ].length;

  const el = document.querySelector('#financialOverview');
  if (!el) return;
  if (totalFineDebt <= 0 && monthlyExp <= 0 && overdueCount === 0) { el.innerHTML=''; return; }

  el.innerHTML = `<article class="panel fo-panel">
    <div class="fo-head"><span class="eyebrow">Finanzüberblick</span></div>
    <div class="fo-grid">
      <div class="fo-cell"><small>Offene Forderungen</small><strong class="${totalFineDebt>0?'col-red':''}">${euro.format(totalFineDebt)}</strong></div>
      <div class="fo-cell"><small>Monatl. Strafraten</small><strong>${euro.format(totalMonthlyRate)}</strong></div>
      <div class="fo-cell"><small>Monatl. Ausgaben</small><strong>${euro.format(monthlyExp)}</strong></div>
      <div class="fo-cell"><small>Nächste Zahlung</small><strong>${upcoming?esc(upcoming.name)+'<br><span class="due-small">'+fmtDate(upcoming.date)+'</span>':'–'}</strong></div>
      ${overdueCount>0?`<div class="fo-cell fo-alert"><small>Überfällig</small><strong class="col-red">${overdueCount}&nbsp;Zahlung${overdueCount!==1?'en':''}</strong></div>`:''}
    </div>
  </article>`;
}

/* Aktive Sparziele kompakt (max. 3) auf Übersicht */
function renderActiveGoalsPreview() {
  const el = document.querySelector('#activeGoalsPreview');
  if (!el) return;
  const active = state.goals.filter(g => g.status === 'active').slice(0, 3);
  if (!active.length) { el.innerHTML = ''; return; }

  const html = active.map(g => {
    const gb  = Math.max(0, goalBalance(g.id));
    const pct = Number(g.target) > 0 ? Math.min(100, gb / Number(g.target) * 100) : 0;
    return `<div class="mini-goal-card">
      <div class="mini-goal-head">
        <span class="mini-goal-name" style="color:${esc(g.color||'#1f8f61')}">${esc(g.icon||'◎')} ${esc(g.name)}</span>
        <span class="mini-goal-pct">${Math.round(pct)}%</span>
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct.toFixed(1)}%;background:${esc(g.color||'var(--green2)')}"></div></div>
      <div class="mini-goal-amounts">${euro.format(gb)} / ${euro.format(g.target)}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="mini-goals-row">
    <div class="mini-goals-head"><span class="eyebrow">Aktive Sparziele</span><button class="text-button" onclick="switchView('goal')">Alle Sparziele →</button></div>
    <div class="mini-goals-grid">${html}</div>
  </div>`;
}

/* ══════════════════════════════════════
   BUCHUNGEN
══════════════════════════════════════ */
function sorted() {
  return [...state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));
}
function txRow(t) {
  const cls     = t.type==='withdraw'?'withdraw':'';
  const goalObj = t.goalId ? state.goals.find(g=>g.id===t.goalId) : null;
  const goalTag = goalObj
    ? `<span class="goal-tag" style="border-color:${esc(goalObj.color||'#1f8f61')};color:${esc(goalObj.color||'#1f8f61')}">${esc(goalObj.name)}</span>`
    : '';
  return `<div class="transaction-row">
    <div class="transaction-icon ${cls}">${t.type==='deposit'?'↓':'↑'}</div>
    <div class="transaction-copy">
      <strong>${esc(t.note||(t.type==='deposit'?'Einzahlung':'Auszahlung'))}</strong>
      <small>${dateFmt.format(new Date(t.date))}${goalTag}</small>
    </div>
    <span class="amount ${cls}">${t.type==='deposit'?'+':'−'}${euro.format(t.amount)}</span>
  </div>`;
}
function renderRecent() {
  const a = sorted().slice(0,5);
  document.querySelector('#recentTransactions').innerHTML =
    a.length ? a.map(txRow).join('') : '<div class="empty">Noch keine Buchungen.<br><small>Nutze die Buttons oben, um deine erste Einzahlung zu erfassen.</small></div>';
}
function balancesById() {
  let s=0, m={};
  [...state.transactions].sort((a,b)=>new Date(a.date)-new Date(b.date))
    .forEach(t => { s += t.type==='deposit'?t.amount:-t.amount; m[t.id]=s; });
  return m;
}
function renderTable() {
  const q      = (document.querySelector('#searchInput')?.value||'').toLowerCase();
  const typeF  = document.querySelector('#typeFilter')?.value||'all';
  const goalF  = document.querySelector('#goalFilter')?.value||'all';
  const bm     = balancesById();
  const rows   = sorted().filter(t => {
    const matchQ    = !q || (t.note||'').toLowerCase().includes(q);
    const matchType = typeF==='all'||t.type===typeF;
    const matchGoal = goalF==='all'||(goalF==='none'&&!t.goalId)||String(t.goalId)===goalF;
    return matchQ && matchType && matchGoal;
  });
  const goalName = id => { const g=state.goals.find(x=>x.id===id); return g?g.name:'–'; };
  document.querySelector('#transactionTable').innerHTML = rows.length
    ? rows.map(t=>`<tr>
        <td>${dateFmt.format(new Date(t.date))}</td>
        <td>${esc(t.note||'–')}</td>
        <td><span class="type-pill ${t.type==='withdraw'?'withdraw':''}">${t.type==='deposit'?'Einzahlung':'Auszahlung'}</span></td>
        <td>${t.goalId?`<span class="cat-pill">${esc(goalName(t.goalId))}</span>`:'<span style="color:var(--muted);font-size:.8em">–</span>'}</td>
        <td class="right amount ${t.type==='withdraw'?'withdraw':''}">${t.type==='deposit'?'+':'−'}${euro.format(t.amount)}</td>
        <td class="right">${euro.format(bm[t.id])}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty">Keine passenden Buchungen.</td></tr>';
}
function populateGoalSelect() {
  const sel = document.querySelector('#goalSelect');
  if (!sel) return;
  const active = state.goals.filter(g => g.status==='active'||g.status==='paused');
  sel.innerHTML = '<option value="">Kein Sparziel</option>' +
    active.map(g=>`<option value="${g.id}">${esc(g.icon||'◎')} ${esc(g.name)}</option>`).join('');
}
function populateGoalFilter() {
  const sel = document.querySelector('#goalFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="all">Alle Sparziele</option><option value="none">Nicht zugeordnet</option>' +
    state.goals.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');
}

/* ══════════════════════════════════════
   MODUL: SPARZIELE
══════════════════════════════════════ */
function renderGoals() {
  const filterVal = document.querySelector('#goalsFilter')?.value || 'active';
  const listEl    = document.querySelector('#goalsList');
  if (!listEl) return;

  let goals = state.goals.filter(g => {
    if (filterVal === 'all')      return true;
    if (filterVal === 'reached')  return goalBalance(g.id) >= Number(g.target);
    return g.status === filterVal;
  });

  if (!goals.length) {
    listEl.innerHTML = `<div class="empty-state">
      <p>${filterVal==='active' ? 'Noch kein aktives Sparziel vorhanden.' : 'Keine Ziele in dieser Kategorie.'}</p>
      ${filterVal==='active'?'<button class="primary" onclick="openAddGoal()">+ Erstes Sparziel erstellen</button>':''}
    </div>`;
    return;
  }

  listEl.innerHTML = goals.map(goalCard).join('');
}

function goalCard(g) {
  const gb      = Math.max(0, goalBalance(g.id));
  const target  = Number(g.target) || 1;
  const pct     = Math.min(100, gb / target * 100);
  const rem     = Math.max(0, target - gb);
  const end     = new Date(g.date + 'T12:00:00');
  const now     = new Date();
  const months  = Math.max(1, (end.getFullYear()-now.getFullYear())*12 + end.getMonth()-now.getMonth());
  const reached = gb >= target;
  const isPrim  = state.primaryGoalId === g.id;
  const stCls   = {active:'st-open', paused:'st-paused', archived:'st-paused', reached:'st-paid'}[reached?'reached':g.status]||'';

  return `<article class="item-card goal-item-card" style="border-top:4px solid ${esc(g.color||'#1f8f61')}">
    <div class="item-card-head">
      <div>
        <h3 class="item-title" style="color:${esc(g.color||'#142033')}">${esc(g.icon||'◎')} ${esc(g.name)}</h3>
        ${g.description?`<div class="item-meta">${esc(g.description)}</div>`:''}
      </div>
      <div class="item-badges">
        ${isPrim?'<span class="prim-badge">Hauptziel</span>':''}
        <span class="st-pill ${stCls}">${reached?'Erreicht!':STATUS_GOAL[g.status]||g.status}</span>
      </div>
    </div>
    <div class="prog-wrap">
      <div class="prog-bar"><div class="prog-fill" style="width:${pct.toFixed(1)}%;background:${esc(g.color||'var(--green2)')}"></div></div>
      <span class="prog-label">${Math.round(pct)}%</span>
    </div>
    <div class="item-amounts">
      <div><small>Gespart</small><strong>${euro.format(gb)}</strong></div>
      <div><small>Ziel</small><strong>${euro.format(target)}</strong></div>
      <div><small>Noch fehlt</small><strong class="${rem>0?'col-red':''}">${euro.format(rem)}</strong></div>
      ${!reached&&g.date?`<div><small>Rate/Monat</small><strong>${euro.format(rem/months)}</strong></div>`:''}
    </div>
    ${g.date?`<div class="item-due">Zieldatum: <strong>${fmtDate(g.date)}</strong></div>`:''}
    ${g.createdAt?`<div class="item-note">Erstellt: ${fmtDate(g.createdAt)}</div>`:''}
    <div class="item-actions">
      ${!isPrim?`<button class="secondary btn-sm" onclick="setPrimaryGoal(${g.id})">Als Hauptziel</button>`:'<span class="prim-indicator">Hauptziel</span>'}
      <button class="secondary btn-sm" onclick="openEditGoal(${g.id})">Bearbeiten</button>
      ${g.status==='active'?`<button class="secondary btn-sm" onclick="pauseGoal(${g.id})">Pausieren</button>`:''}
      ${g.status==='paused'?`<button class="secondary btn-sm" onclick="unpauseGoal(${g.id})">Aktivieren</button>`:''}
      ${g.status!=='archived'?`<button class="secondary btn-sm" onclick="archiveGoal(${g.id})">Archivieren</button>`:''}
      <button class="secondary btn-sm danger" onclick="deleteGoal(${g.id})">Löschen</button>
    </div>
  </article>`;
}

function openAddGoal() {
  editGoalId = null;
  document.querySelector('#formModalEyebrow').textContent = 'Neues Sparziel';
  document.querySelector('#formModalTitle').textContent   = 'Sparziel erstellen';
  document.querySelector('#goalForm').reset();
  document.querySelector('#goalFormStatus').value = 'active';
  document.querySelector('#goalFormColor').value  = '#1f8f61';
  document.querySelector('#goalFormIcon').value   = '◎';
  document.querySelector('#goalFormDate').value   = '';
  showFormModal('goalForm');
}
function openEditGoal(id) {
  editGoalId = id;
  const g = state.goals.find(x=>x.id===id);
  if (!g) return;
  document.querySelector('#formModalEyebrow').textContent = 'Sparziel bearbeiten';
  document.querySelector('#formModalTitle').textContent   = g.name;
  document.querySelector('#goalFormName').value   = g.name;
  document.querySelector('#goalFormStatus').value = g.status;
  document.querySelector('#goalFormDesc').value   = g.description||'';
  document.querySelector('#goalFormTarget').value = g.target;
  document.querySelector('#goalFormDate').value   = g.date||'';
  document.querySelector('#goalFormColor').value  = g.color||'#1f8f61';
  document.querySelector('#goalFormIcon').value   = g.icon||'◎';
  showFormModal('goalForm');
}
function setPrimaryGoal(id) {
  state.primaryGoalId = id;
  save(); render(); renderGoals();
  showToast('Hauptziel aktualisiert.');
}
function pauseGoal(id) {
  const g = state.goals.find(x=>x.id===id);
  if (!g) return;
  g.status = 'paused';
  save(); render(); renderGoals();
  showToast('Sparziel pausiert.');
}
function unpauseGoal(id) {
  const g = state.goals.find(x=>x.id===id);
  if (!g) return;
  g.status = 'active';
  save(); render(); renderGoals();
  showToast('Sparziel aktiviert.');
}
function archiveGoal(id) {
  const g = state.goals.find(x=>x.id===id);
  if (!g) return;
  if (!confirm('Sparziel „' + g.name + '" archivieren?\nDie zugehörigen Buchungen bleiben erhalten.')) return;
  g.status = 'archived';
  if (state.primaryGoalId === id) state.primaryGoalId = null;
  save(); render(); renderGoals();
  showToast('Sparziel archiviert.');
}
function deleteGoal(id) {
  const g = state.goals.find(x=>x.id===id);
  if (!g) return;
  if (!confirm('Sparziel „' + g.name + '" wirklich löschen?\n\nZugehörige Buchungen bleiben erhalten und werden als „Nicht zugeordnet" behandelt.')) return;
  state.goals = state.goals.filter(x=>x.id!==id);
  if (state.primaryGoalId === id) state.primaryGoalId = null;
  save(); render(); renderGoals();
  showToast('Sparziel gelöscht.');
}

/* ══════════════════════════════════════
   MODUL: STRAFEN
══════════════════════════════════════ */
function renderFines() {
  const q       = (document.querySelector('#finesSearch')?.value||'').toLowerCase();
  const statusF = document.querySelector('#finesFilter')?.value||'all';
  const sortBy  = document.querySelector('#finesSort')?.value||'due';

  const all = state.fines;
  const totalDebt      = all.reduce((s,f)=>s+Number(f.totalAmount),0);
  const totalPaid      = all.reduce((s,f)=>s+finePaid(f),0);
  const totalRemaining = all.reduce((s,f)=>s+fineRemaining(f),0);
  const totalRate      = all.filter(f=>f.status==='installment').reduce((s,f)=>s+Number(f.monthlyRate||0),0);
  const openCount      = all.filter(f=>f.status!=='paid').length;
  const overdueCount   = all.filter(f=>f.status!=='paid'&&isOverdue(f.nextDueDate)).length;

  const summEl = document.querySelector('#finesSummary');
  if (summEl) summEl.innerHTML = all.length ? `
    <div class="summ-card"><small>Gesamtforderung</small><strong>${euro.format(totalDebt)}</strong></div>
    <div class="summ-card"><small>Bereits bezahlt</small><strong class="col-green">${euro.format(totalPaid)}</strong></div>
    <div class="summ-card"><small>Offener Restbetrag</small><strong class="${totalRemaining>0?'col-red':''}">${euro.format(totalRemaining)}</strong></div>
    <div class="summ-card"><small>Monatl. Raten</small><strong>${euro.format(totalRate)}</strong></div>
    <div class="summ-card"><small>Offen / Überfällig</small><strong>${openCount}&thinsp;/&thinsp;<span class="${overdueCount>0?'col-red':''}">${overdueCount}</span></strong></div>
  ` : '';

  let fines = all.filter(f => {
    const mQ = !q||f.name.toLowerCase().includes(q)||f.creditor.toLowerCase().includes(q)||(f.reference||'').toLowerCase().includes(q);
    return mQ && (statusF==='all'||f.status===statusF);
  });
  if (sortBy==='due')       fines.sort((a,b)=>(a.nextDueDate||'9').localeCompare(b.nextDueDate||'9'));
  else if (sortBy==='remaining') fines.sort((a,b)=>fineRemaining(b)-fineRemaining(a));
  else fines.sort((a,b)=>a.name.localeCompare(b.name,'de'));

  const listEl = document.querySelector('#finesList');
  if (!listEl) return;
  listEl.innerHTML = fines.length
    ? fines.map(fineCard).join('')
    : `<div class="empty-state"><p>${all.length?'Keine Strafen gefunden.':'Noch keine Strafe erfasst.'}</p></div>`;
}

function fineCard(f) {
  const paid      = finePaid(f);
  const remaining = fineRemaining(f);
  const pct       = f.totalAmount > 0 ? Math.min(100, paid / f.totalAmount * 100) : 0;
  const overdue   = f.status !== 'paid' && isOverdue(f.nextDueDate);
  const stCls     = {open:'st-open',installment:'st-install',paid:'st-paid',paused:'st-paused'}[f.status]||'';

  return `<article class="item-card${overdue?' overdue':''}${f.status==='paid'?' is-paid':''}">
    <div class="item-card-head">
      <div>
        <h3 class="item-title">${esc(f.name)}</h3>
        <div class="item-meta">${esc(f.creditor)}${f.reference?' · <em>'+esc(f.reference)+'</em>':''}</div>
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
    ${f.nextDueDate&&f.status!=='paid'?`<div class="item-due${overdue?' col-red':''}">Nächste Zahlung: <strong>${fmtDate(f.nextDueDate)}</strong> ${daysTag(f.nextDueDate,false)}</div>`:''}
    ${f.note?`<p class="item-note">${esc(f.note)}</p>`:''}
    <div class="item-actions">
      ${f.status!=='paid'?`<button class="secondary btn-sm" onclick="openPayFine(${f.id})">Zahlung erfassen</button>`:''}
      <button class="secondary btn-sm" onclick="openEditFine(${f.id})">Bearbeiten</button>
      ${f.status==='open'||f.status==='installment'?`<button class="secondary btn-sm" onclick="pauseFine(${f.id})">Pausieren</button>`:''}
      ${f.status==='paused'?`<button class="secondary btn-sm" onclick="reactivateFine(${f.id})">Reaktivieren</button>`:''}
      ${f.status!=='paid'?`<button class="secondary btn-sm" onclick="markFinePaid(${f.id})">Als bezahlt</button>`:''}
      <button class="secondary btn-sm danger" onclick="deleteFine(${f.id})">Löschen</button>
      ${f.payments&&f.payments.length?`<button class="text-button btn-sm" onclick="togglePayments(${f.id})">Verlauf (${f.payments.length})</button>`:''}
    </div>
    <div class="payment-history" id="ph-${f.id}" hidden>
      ${(f.payments||[]).slice().reverse().map(p=>`<div class="payment-row">
        <span>${fmtDate(p.date)}</span><span>${esc(p.note||'–')}</span>
        <strong class="col-green">+${euro.format(p.amount)}</strong>
      </div>`).join('')}
    </div>
  </article>`;
}

function togglePayments(id) {
  const el = document.querySelector('#ph-'+id);
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
  const f = state.fines.find(x=>x.id===id);
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
  const f = state.fines.find(x=>x.id===id);
  if (!f) return;
  const rem = fineRemaining(f);
  document.querySelector('#formModalEyebrow').textContent = 'Zahlung erfassen';
  document.querySelector('#formModalTitle').textContent   = f.name;
  document.querySelector('#finePaymentForm').reset();
  document.querySelector('#finePaymentDate').value   = new Date().toISOString().slice(0,10);
  if (f.monthlyRate) document.querySelector('#finePaymentAmount').value = Math.min(f.monthlyRate, rem);
  const hint = document.querySelector('#finePaymentHint');
  if (hint) hint.textContent = 'Offener Restbetrag: ' + euro.format(rem);
  showFormModal('finePaymentForm');
}
function pauseFine(id) {
  const f = state.fines.find(x=>x.id===id);
  if (!f) return;
  f.status = 'paused'; save(); renderFines(); renderFinancialOverview();
  showToast('Strafe pausiert.');
}
function reactivateFine(id) {
  const f = state.fines.find(x=>x.id===id);
  if (!f) return;
  f.status = f.monthlyRate > 0 ? 'installment' : 'open';
  save(); renderFines(); renderFinancialOverview();
  showToast('Strafe reaktiviert.');
}
function markFinePaid(id) {
  const f = state.fines.find(x=>x.id===id);
  if (!f) return;
  if (!confirm('Strafe „' + f.name + '" als vollständig bezahlt markieren?')) return;
  f.status = 'paid'; save(); renderFines(); renderFinancialOverview();
  showToast('Strafe als bezahlt markiert.');
}
function deleteFine(id) {
  const f = state.fines.find(x=>x.id===id);
  if (!f) return;
  if (!confirm('Strafe „' + f.name + '" wirklich löschen?\n\nDer gesamte Zahlungsverlauf wird ebenfalls gelöscht.')) return;
  state.fines = state.fines.filter(x=>x.id!==id);
  save(); renderFines(); renderFinancialOverview();
  showToast('Strafe gelöscht.');
}

/* ══════════════════════════════════════
   MODUL: AUSGABEN
══════════════════════════════════════ */
function renderExpenses() {
  const q      = (document.querySelector('#expensesSearch')?.value||'').toLowerCase();
  const catF   = document.querySelector('#expensesCategoryFilter')?.value||'all';
  const intF   = document.querySelector('#expensesIntervalFilter')?.value||'all';
  const statF  = document.querySelector('#expensesStatusFilter')?.value||'all';
  const allExp = state.expenses;

  const monthlyTotal = totalMonthlyExpenses();
  const openCount    = allExp.filter(e=>e.active&&!e.paid).length;
  const nextDueExp   = allExp.filter(e=>e.active&&!e.paid&&e.nextDueDate)
    .sort((a,b)=>a.nextDueDate.localeCompare(b.nextDueDate))[0];
  const byCat = {};
  allExp.filter(e=>e.active&&e.interval!=='once').forEach(e=>{
    byCat[e.category]=(byCat[e.category]||0)+toMonthly(Number(e.amount),e.interval);
  });

  const summEl = document.querySelector('#expensesSummary');
  if (summEl) summEl.innerHTML = allExp.length ? `
    <div class="summ-card"><small>Monatl. Ausgaben</small><strong>${euro.format(monthlyTotal)}</strong></div>
    <div class="summ-card"><small>Noch offen</small><strong>${openCount}</strong></div>
    <div class="summ-card"><small>Nächste Fälligkeit</small><strong>${nextDueExp?esc(nextDueExp.name)+'<br><span class="due-small">'+fmtDate(nextDueExp.nextDueDate)+'</span>':'–'}</strong></div>
    <div class="summ-card"><small>Kategorien (mtl.)</small><div class="cat-dist">${
      Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,4)
        .map(([k,v])=>`<span class="cat-pill">${esc(k)}: ${euro.format(v)}</span>`).join('')
    }</div></div>
  ` : '';

  let expenses = allExp.filter(e=>{
    const mQ   = !q||e.name.toLowerCase().includes(q)||e.category.toLowerCase().includes(q);
    const mCat = catF==='all'||e.category===catF;
    const mInt = intF==='all'||e.interval===intF;
    let mSt    = true;
    if (statF==='active')  mSt = e.active&&!e.paid;
    if (statF==='paused')  mSt = !e.active;
    if (statF==='overdue') mSt = e.active&&!e.paid&&isOverdue(e.nextDueDate);
    return mQ&&mCat&&mInt&&mSt;
  }).sort((a,b)=>(a.nextDueDate||'9').localeCompare(b.nextDueDate||'9'));

  const listEl = document.querySelector('#expensesList');
  if (!listEl) return;
  listEl.innerHTML = expenses.length
    ? expenses.map(expenseCard).join('')
    : `<div class="empty-state"><p>${allExp.length?'Keine Ausgaben gefunden.':'Noch keine Ausgabe erfasst.'}</p></div>`;
}

function expenseCard(e) {
  const overdue = e.active&&!e.paid&&isOverdue(e.nextDueDate);
  const monthly = toMonthly(Number(e.amount), e.interval);
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
        ${!e.active?'<span class="st-pill st-paused">Pausiert</span>':e.paid?'<span class="st-pill st-paid">Bezahlt</span>':overdue?'<span class="overdue-tag">Überfällig</span>':'<span class="st-pill st-open">Aktiv</span>'}
      </div>
    </div>
    <div class="item-amounts">
      <div><small>Betrag</small><strong>${euro.format(e.amount)}</strong></div>
      ${e.interval!=='once'?`<div><small>Pro Monat</small><strong>${euro.format(monthly)}</strong></div>`:''}
      ${e.paymentMethod?`<div><small>Zahlungsweg</small><strong>${esc(e.paymentMethod)}</strong></div>`:''}
    </div>
    ${e.nextDueDate?`<div class="item-due${overdue?' col-red':''}">
      ${e.interval==='once'?'Fälligkeit':'Nächste Fälligkeit'}: <strong>${fmtDate(e.nextDueDate)}</strong>
      ${!e.paid?daysTag(e.nextDueDate,false):''}
    </div>`:''}
    ${e.note?`<p class="item-note">${esc(e.note)}</p>`:''}
    <div class="item-actions">
      ${e.active&&!e.paid?`<button class="secondary btn-sm" onclick="markExpensePaid(${e.id})">Als bezahlt markieren</button>`:''}
      ${e.paid&&e.interval==='once'?`<button class="secondary btn-sm" onclick="markExpenseUnpaid(${e.id})">Als offen markieren</button>`:''}
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
  const e = state.expenses.find(x=>x.id===id);
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
  const e = state.expenses.find(x=>x.id===id);
  if (!e) return;
  if (e.interval === 'once') {
    e.paid = true;
    showToast('Als bezahlt markiert.');
  } else {
    advanceDueDate(e);
    e.paid = false;
    showToast('Zahlung erfasst. Nächste Fälligkeit: ' + fmtDate(e.nextDueDate));
  }
  save(); renderExpenses(); renderFinancialOverview();
}
function markExpenseUnpaid(id) {
  const e = state.expenses.find(x=>x.id===id);
  if (!e) return;
  e.paid = false;
  save(); renderExpenses();
  showToast('Als offen markiert.');
}
function toggleExpenseActive(id) {
  const e = state.expenses.find(x=>x.id===id);
  if (!e) return;
  e.active = !e.active;
  save(); renderExpenses(); renderFinancialOverview();
  showToast(e.active?'Ausgabe aktiviert.':'Ausgabe pausiert.');
}
function deleteExpense(id) {
  const e = state.expenses.find(x=>x.id===id);
  if (!e) return;
  if (!confirm('Ausgabe „' + e.name + '" wirklich löschen?')) return;
  state.expenses = state.expenses.filter(x=>x.id!==id);
  save(); renderExpenses(); renderFinancialOverview();
  showToast('Ausgabe gelöscht.');
}

/* ══════════════════════════════════════
   KONTOAUSZUG
══════════════════════════════════════ */
function renderStatement() {
  const b   = balance();
  const dep = state.transactions.filter(t=>t.type==='deposit').reduce((s,t)=>s+t.amount,0);
  const wd  = state.transactions.filter(t=>t.type==='withdraw').reduce((s,t)=>s+t.amount,0);
  const bm  = balancesById();
  const goalName = id => { const g=state.goals.find(x=>x.id===id); return g?g.name:'–'; };
  document.querySelector('#statementPreview').innerHTML = `
    <div class="statement-brand">
      <div><span class="eyebrow">Privater Sparauszug</span><h2>SparBox</h2></div>
      <div>Erstellt am ${dateFmt.format(new Date())}</div>
    </div>
    <div class="statement-summary">
      <div><small>Einzahlungen</small><strong>${euro.format(dep)}</strong></div>
      <div><small>Auszahlungen</small><strong>${euro.format(wd)}</strong></div>
      <div><small>Kontostand</small><strong>${euro.format(b)}</strong></div>
    </div>
    ${sorted().length===0?'<p class="empty">Noch keine Buchungen vorhanden.</p>':''}
    <div class="table-wrap"><table><thead><tr><th>Datum</th><th>Beschreibung</th><th>Sparziel</th><th class="right">Betrag</th><th class="right">Stand</th></tr></thead>
    <tbody>${sorted().map(t=>`<tr>
      <td>${dateFmt.format(new Date(t.date))}</td>
      <td>${esc(t.note||'–')}</td>
      <td>${t.goalId?esc(goalName(t.goalId)):'–'}</td>
      <td class="right">${t.type==='deposit'?'+':'−'}${euro.format(t.amount)}</td>
      <td class="right">${euro.format(bm[t.id])}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

/* ══════════════════════════════════════
   FORM-MODAL
══════════════════════════════════════ */
function showFormModal(formId) {
  ['goalForm','fineForm','finePaymentForm','expenseForm'].forEach(id=>{
    document.querySelector('#'+id).hidden = (id!==formId);
  });
  document.querySelector('#formBackdrop').hidden = false;
  setTimeout(()=>{
    const first = document.querySelector('#formBackdrop form:not([hidden]) input:not([hidden]), #formBackdrop form:not([hidden]) select');
    if (first) first.focus();
  }, 60);
}
function closeFormModal() {
  document.querySelector('#formBackdrop').hidden = true;
  editGoalId = editFineId = editExpenseId = payFineId = null;
}

/* ── ANSICHT WECHSELN ── */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+name));
  document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active', v.dataset.view===name));
  document.querySelector('#viewTitle').textContent = VIEWS[name]||name;
  document.querySelector('.sidebar').classList.remove('open');
  if (name==='goal')     renderGoals();
  if (name==='fines')    renderFines();
  if (name==='expenses') renderExpenses();
}

/* ── EINFACHES MODAL (Buchung / Öffnung) ── */
function openModal(mode) {
  modalMode = mode;
  const tx = mode!=='unlock';
  document.querySelector('#transactionForm').hidden = !tx;
  document.querySelector('#unlockForm').hidden      = tx;
  document.querySelector('#modalEyebrow').textContent = mode==='unlock'?'Sicherheit':'Neue Buchung';
  document.querySelector('#modalTitle').textContent   = mode==='deposit'?'Einzahlung hinzufügen':mode==='withdraw'?'Auszahlung erfassen':'SparBox öffnen';
  document.querySelector('#modalHint').textContent    = mode==='deposit'?'Trage den Betrag ein, den du in die Box gelegt hast.':mode==='withdraw'?'Der Betrag wird vom aktuellen Sparstand abgezogen.':'Gib deinen sechsstelligen Öffnungs-PIN ein.';
  document.querySelector('#transactionSubmit').textContent = mode==='deposit'?'Einzahlung speichern':'Auszahlung speichern';
  document.querySelector('#modalBackdrop').hidden = false;
  setTimeout(()=>document.querySelector(tx?'#amountInput':'#unlockPin').focus(), 60);
}
function closeModal() {
  document.querySelector('#modalBackdrop').hidden = true;
  document.querySelector('#transactionForm').reset();
  document.querySelector('#unlockForm').reset();
}

/* ══════════════════════════════════════
   PDF
══════════════════════════════════════ */
function pdfEsc(s) {
  return String(s==null?'':s)
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
    .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue')
    .replace(/ß/g,'ss').replace(/€/g,'EUR')
    .replace(/[^\x20-\x7E]/g,'?').replace(/([\\()])/g,'\\$1');
}
function buildPdf(lines) {
  let content='BT /F1 10 Tf 50 820 Td ';
  lines.forEach((l,i)=>{ content+=(i?'0 -15 Td ':'')+'('+pdfEsc(l)+') Tj '; });
  content+='ET';
  const objs=[
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
  const goalName=id=>{const g=state.goals.find(x=>x.id===id);return g?g.name:'';};
  const lines=['SparBox - Kontoauszug','Erstellt: '+dateFmt.format(new Date()),
    'Aktueller Stand: '+euro.format(balance()),'',
    'Datum       Beschreibung                   Sparziel        Betrag'];
  sorted().forEach(t=>lines.push(
    dateFmt.format(new Date(t.date))+'   '+
    (t.note||'').slice(0,28).padEnd(30)+
    (t.goalId?goalName(t.goalId):'').slice(0,14).padEnd(16)+
    (t.type==='deposit'?'+':'-')+t.amount.toFixed(2)+' EUR'));
  dlPdf(buildPdf(lines),'SparBox-Kontoauszug-'+new Date().toISOString().slice(0,10)+'.pdf');
}
function makeFinesPdf() {
  const lines=['SparBox - Strafenuebersicht','Erstellt: '+dateFmt.format(new Date()),'',
    'Gesamtforderung: '+state.fines.reduce((s,f)=>s+Number(f.totalAmount),0).toFixed(2)+' EUR',
    'Offener Restbetrag: '+state.fines.reduce((s,f)=>s+fineRemaining(f),0).toFixed(2)+' EUR','',
    'Name                     Glaeubiger         Gesamt  Bezahlt  Rest    Status'];
  state.fines.forEach(f=>{
    lines.push(f.name.slice(0,24).padEnd(25)+f.creditor.slice(0,17).padEnd(18)+
      f.totalAmount.toFixed(2).padStart(8)+' '+finePaid(f).toFixed(2).padStart(8)+' '+
      fineRemaining(f).toFixed(2).padStart(8)+' '+(STATUS_FINE[f.status]||f.status));
    if (f.nextDueDate&&f.status!=='paid') lines.push('  Naechste Zahlung: '+fmtDate(f.nextDueDate));
    (f.payments||[]).forEach(p=>lines.push('  > '+fmtDate(p.date)+'  '+(p.note||'').slice(0,20).padEnd(22)+p.amount.toFixed(2)+' EUR'));
  });
  dlPdf(buildPdf(lines),'SparBox-Strafen-'+new Date().toISOString().slice(0,10)+'.pdf');
}
function makeExpensesPdf() {
  const lines=['SparBox - Ausgabenuebersicht','Erstellt: '+dateFmt.format(new Date()),
    'Geschaetzte Monatsausgaben: '+totalMonthlyExpenses().toFixed(2)+' EUR','',
    'Name                     Kategorie    Betrag   Intervall    Faellig'];
  state.expenses.sort((a,b)=>(a.nextDueDate||'').localeCompare(b.nextDueDate||''))
    .forEach(e=>lines.push(e.name.slice(0,24).padEnd(25)+e.category.slice(0,12).padEnd(13)+
      Number(e.amount).toFixed(2).padStart(8)+' '+(INTERVAL_LABEL[e.interval]||'').slice(0,12).padEnd(13)+fmtDate(e.nextDueDate)));
  dlPdf(buildPdf(lines),'SparBox-Ausgaben-'+new Date().toISOString().slice(0,10)+'.pdf');
}

/* ══════════════════════════════════════
   EVENT LISTENER
══════════════════════════════════════ */
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
document.querySelector('#goalCancelBtn').addEventListener('click',closeFormModal);
document.querySelector('#fineCancelBtn').addEventListener('click',closeFormModal);
document.querySelector('#finePaymentCancelBtn').addEventListener('click',closeFormModal);
document.querySelector('#expenseCancelBtn').addEventListener('click',closeFormModal);

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();closeFormModal();}
});

/* Modul-Buttons */
document.querySelector('#addGoalBtn').addEventListener('click',openAddGoal);
document.querySelector('#addFineBtn').addEventListener('click',openAddFine);
document.querySelector('#addExpenseBtn').addEventListener('click',openAddExpense);

/* Filter */
document.querySelector('#searchInput').addEventListener('input',renderTable);
document.querySelector('#typeFilter').addEventListener('change',renderTable);
document.querySelector('#goalFilter').addEventListener('change',renderTable);
document.querySelector('#goalsFilter').addEventListener('change',renderGoals);
document.querySelector('#finesSearch').addEventListener('input',renderFines);
document.querySelector('#finesFilter').addEventListener('change',renderFines);
document.querySelector('#finesSort').addEventListener('change',renderFines);
document.querySelector('#expensesSearch').addEventListener('input',renderExpenses);
document.querySelector('#expensesCategoryFilter').addEventListener('change',renderExpenses);
document.querySelector('#expensesIntervalFilter').addEventListener('change',renderExpenses);
document.querySelector('#expensesStatusFilter').addEventListener('change',renderExpenses);

/* FORMULARE */
document.querySelector('#transactionForm').addEventListener('submit',e=>{
  e.preventDefault();
  const amount=Number(document.querySelector('#amountInput').value);
  if(!amount)return;
  if(modalMode==='withdraw'&&amount>balance()){showToast('Auszahlung ist höher als der aktuelle Sparstand.');return;}
  const goalId = document.querySelector('#goalSelect').value
    ? Number(document.querySelector('#goalSelect').value) : undefined;
  state.transactions.push({id:uid(),type:modalMode,amount,
    note:document.querySelector('#noteInput').value.trim()||(modalMode==='deposit'?'Einzahlung':'Auszahlung'),
    date:new Date().toISOString(), ...(goalId?{goalId}:{})});
  save();render();closeModal();
  showToast((modalMode==='deposit'?'Einzahlung':'Auszahlung')+' gespeichert.');
});

document.querySelector('#unlockForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(document.querySelector('#unlockPin').value===state.pin){closeModal();showToast('PIN korrekt – Öffnung wurde simuliert.');}
  else showToast('PIN ist nicht korrekt.');
});

document.querySelector('#pinForm').addEventListener('submit',e=>{
  e.preventDefault();
  const a=document.querySelector('#pinInput').value, b=document.querySelector('#pinConfirm').value;
  if(!/^\d{6}$/.test(a)){showToast('Der PIN muss aus sechs Zahlen bestehen.');return;}
  if(a!==b){showToast('Die PIN-Eingaben stimmen nicht überein.');return;}
  state.pin=a;save();e.target.reset();showToast('PIN wurde geändert.');
});

document.querySelector('#goalForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=document.querySelector('#goalFormName').value.trim();
  if(!name){showToast('Bitte einen Namen eingeben.');return;}
  const data={
    name, status:document.querySelector('#goalFormStatus').value,
    description:document.querySelector('#goalFormDesc').value.trim(),
    target:Number(document.querySelector('#goalFormTarget').value),
    date:document.querySelector('#goalFormDate').value,
    color:document.querySelector('#goalFormColor').value,
    icon:document.querySelector('#goalFormIcon').value
  };
  if(editGoalId){
    const g=state.goals.find(x=>x.id===editGoalId);
    if(g)Object.assign(g,data);
    showToast('Sparziel gespeichert.');
  } else {
    const newId=uid();
    state.goals.push({id:newId, createdAt:new Date().toISOString().slice(0,10), ...data});
    if(!state.primaryGoalId&&data.status==='active') state.primaryGoalId=newId;
    showToast('Sparziel erstellt.');
  }
  save();render();renderGoals();closeFormModal();
});

document.querySelector('#fineForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=document.querySelector('#fineName').value.trim();
  const creditor=document.querySelector('#fineCreditor').value.trim();
  if(!name||!creditor){showToast('Bitte Bezeichnung und Gläubiger ausfüllen.');return;}
  const data={name,creditor,
    reference:document.querySelector('#fineReference').value.trim(),
    status:document.querySelector('#fineStatus').value,
    totalAmount:Number(document.querySelector('#fineTotalAmount').value),
    monthlyRate:Number(document.querySelector('#fineMonthlyRate').value)||0,
    nextDueDate:document.querySelector('#fineNextDue').value,
    startDate:document.querySelector('#fineStartDate').value,
    note:document.querySelector('#fineNote').value.trim()};
  if(editFineId){
    const f=state.fines.find(x=>x.id===editFineId);
    if(f)Object.assign(f,data);
    showToast('Strafe gespeichert.');
  } else {
    state.fines.push({id:uid(),payments:[],...data});
    showToast('Strafe erfasst.');
  }
  save();renderFines();renderFinancialOverview();closeFormModal();
});

document.querySelector('#finePaymentForm').addEventListener('submit',e=>{
  e.preventDefault();
  const f=state.fines.find(x=>x.id===payFineId);
  if(!f)return;
  const amount=Number(document.querySelector('#finePaymentAmount').value);
  const date=document.querySelector('#finePaymentDate').value;
  const note=document.querySelector('#finePaymentNote').value.trim();
  const rem=fineRemaining(f);
  if(amount>rem&&!confirm('Der Betrag ('+euro.format(amount)+') übersteigt den Restbetrag ('+euro.format(rem)+').\nTrotzdem erfassen?')) return;
  if(!f.payments)f.payments=[];
  f.payments.push({id:uid(),amount,date,note});
  if(fineRemaining(f)<=0){f.status='paid';showToast('Strafe vollständig bezahlt!');}
  else showToast('Zahlung von '+euro.format(amount)+' erfasst.');
  save();renderFines();renderFinancialOverview();closeFormModal();
});

document.querySelector('#expenseForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=document.querySelector('#expenseName').value.trim();
  if(!name){showToast('Bitte eine Bezeichnung eingeben.');return;}
  const data={name,
    category:document.querySelector('#expenseCategory').value,
    amount:Number(document.querySelector('#expenseAmount').value),
    interval:document.querySelector('#expenseInterval').value,
    nextDueDate:document.querySelector('#expenseNextDue').value,
    paymentMethod:document.querySelector('#expensePaymentMethod').value.trim(),
    note:document.querySelector('#expenseNote').value.trim()};
  if(editExpenseId){
    const ex=state.expenses.find(x=>x.id===editExpenseId);
    if(ex)Object.assign(ex,data);
    showToast('Ausgabe gespeichert.');
  } else {
    state.expenses.push({id:uid(),active:true,paid:false,...data});
    showToast('Ausgabe erfasst.');
  }
  save();renderExpenses();renderFinancialOverview();closeFormModal();
});

document.querySelector('#resetData').addEventListener('click',()=>{
  if(!confirm('Alle lokalen Daten wirklich löschen?\n\nDabei werden alle Sparziele, Buchungen, Strafen, Zahlungsverläufe und Ausgaben dauerhaft gelöscht.\n\nDieser Vorgang kann nicht rückgängig gemacht werden.'))return;
  localStorage.removeItem('sparbox-state');
  localStorage.removeItem('sparbox-mv');
  state=structuredClone(defaults);
  save();render();renderFines();renderExpenses();renderGoals();
  showToast('Alle Daten wurden gelöscht.');
});

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
