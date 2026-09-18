export const LANG_KEY = 'mixmax-language';
export const DEFAULT_LANG = 'de';

const dictionaries = {
  de: {
    app_title: 'MixMax Manager',
    loading: 'MixMax Manager wird geladen…',
    setup_title: 'Supabase ist noch nicht konfiguriert.',
    setup_hint: 'Setze lokal in .env und in Vercel die Variablen VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY. Vorlagen stehen in .env.example.',
    login_intro: 'Bitte anmelden, um das gemeinsame Buch zu sehen.',
    email: 'E-Mail',
    password: 'Passwort',
    sign_in: 'Anmelden',
    login_failed: 'Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.',
    login_offline: 'Verbindung fehlgeschlagen. Bitte erneut versuchen.',
    nav_main: 'Hauptnavigation',
    nav_overview: 'Übersicht',
    nav_bookings: 'Buchungen',
    nav_employees: 'Mitarbeiter',
    nav_statement: 'Kontoauszug',
    nav_settings: 'Einstellungen',
    menu: 'Menü öffnen',
    shared_ledger: 'Gemeinsames Buch',
    shared_ledger_sub: 'Siraj & Chedi · TND',
    current_balance: 'Aktueller Stand',
    income_minus_expenses: 'Einzahlungen minus Ausgaben',
    summary: 'Auswertung',
    total_income: 'Gesamte Einzahlungen',
    total_expenses: 'Gesamte Ausgaben',
    paid_by_siraj: 'Von Siraj bezahlt',
    paid_by_chedi: 'Von Chedi bezahlt',
    recent_activity: 'Verlauf',
    recent_bookings: 'Letzte Buchungen',
    view_all: 'Alle anzeigen →',
    no_bookings: 'Noch keine Buchungen.',
    no_bookings_saved: 'Noch keine Buchungen gespeichert.',
    quick_entry: 'Schnell erfassen',
    new_booking: 'Neue Buchung',
    type: 'Typ',
    type_out: 'Ausgabe',
    type_in: 'Einzahlung',
    amount: 'Betrag',
    amount_placeholder: 'z. B. 85,500',
    category: 'Kategorie',
    category_placeholder: 'Kategorie wählen',
    item: 'Artikel',
    item_placeholder: 'Artikel wählen',
    item_name: 'Artikelname',
    item_name_placeholder: 'z. B. Mayonnaise',
    date: 'Datum',
    paid_by: 'Bezahlt von',
    paid_siraj: 'Siraj',
    paid_chedi: 'Chedi',
    paid_other: 'Andere',
    note: 'Beschreibung / Notiz',
    note_optional: 'optional',
    booking_hint: 'Kein Speichern-Button: Die Buchung wird gespeichert, sobald alle Pflichtfelder stehen – beim Betrag erst mit Enter oder wenn das Feld verlassen wird.',
    ledger: 'Buch',
    saved_bookings: 'Gespeicherte Buchungen',
    save_offline: 'Verbindung fehlgeschlagen. Buchung wurde nicht gespeichert.',
    save_failed: 'Speichern fehlgeschlagen. Buchung wurde nicht gespeichert.',
    load_offline: 'Verbindung fehlgeschlagen. Buchungen konnten nicht geladen werden.',
    load_failed: 'Buchungen konnten nicht geladen werden.',
    saved: '{amount} gespeichert',
    remove: 'Entfernen',
    confirm_remove_booking: 'Buchung über {amount} wirklich entfernen?',
    delete_offline: 'Verbindung fehlgeschlagen. Buchung wurde nicht gelöscht.',
    delete_failed: 'Löschen fehlgeschlagen.',
    manage_employees: 'Mitarbeiter verwalten',
    employee_name: 'Mitarbeitername',
    employee_name_placeholder: 'z. B. Ahmed',
    add: 'Hinzufügen',
    add_employee_hint: 'Siraj und Chedi sehen dieselbe Liste. Chedi und Siraj sind nicht automatisch Mitarbeiter.',
    no_employees: 'Noch keine Mitarbeiter. Füge zuerst einen Mitarbeiter hinzu.',
    employee_empty: 'Bitte einen Namen eingeben.',
    employee_duplicate: 'Diesen Mitarbeiter gibt es bereits.',
    employee_save_failed: 'Mitarbeiter konnte nicht gespeichert werden.',
    employee_delete_failed: 'Mitarbeiter konnte nicht entfernt werden.',
    confirm_remove_employee: 'Mitarbeiter {name} wirklich entfernen?',
    employees_eyebrow: 'Personal',
    record_advance: 'Vorschuss erfassen',
    employee: 'Mitarbeiter',
    employee_placeholder: 'Mitarbeiter wählen',
    advance_amount_placeholder: 'z. B. 100,000',
    advance_note: 'Notiz',
    advance_hint: 'Ein Vorschuss ist eine normale Personal-Ausgabe im gemeinsamen Buch. Speichern wie bei Buchungen: letztes Pflichtfeld, Enter oder Betragsfeld verlassen.',
    advances_by_employee: 'Vorschüsse je Mitarbeiter',
    saved_advances: 'Gespeicherte Vorschüsse',
    no_advances: 'Noch keine Vorschüsse gespeichert.',
    last_advance: 'Letzter: {date}',
    no_advance_yet: 'Noch kein Vorschuss',
    history: 'Historie',
    statement_intro: 'Chronologische Historie aller MixMax-Buchungen in TND.',
    statement_pdf: 'Kontoauszug PDF',
    statement_title: 'Kontoauszug',
    col_date: 'Datum',
    col_type: 'Typ',
    col_category: 'Kategorie',
    col_item_advance: 'Artikel / Vorschuss',
    col_paid_by: 'Bezahlt von',
    col_note: 'Beschreibung',
    col_amount: 'Betrag',
    col_balance: 'Stand',
    income: 'Einzahlungen',
    expenses: 'Ausgaben',
    created: 'Erstellt',
    account: 'Konto',
    signed_in: 'Angemeldet',
    sign_out: 'Abmelden',
    data: 'Daten',
    settings_ledger: 'Quelle der Wahrheit ist die Supabase-Tabelle bookings. Vorschüsse sind Personal-Ausgaben in derselben Tabelle. Alte SparBox-Daten im Browser werden nicht verwendet.',
    settings_currency: 'Währung: Tunesischer Dinar (TND), 3 Nachkommastellen.',
    language: 'Sprache',
    language_de: 'Deutsch',
    language_en: 'English',
    advance_label: 'Vorschuss',
    pdf_item: 'Artikel',
    pdf_advance: 'Vorschuss'
  },
  en: {
    app_title: 'MixMax Manager',
    loading: 'Loading MixMax Manager…',
    setup_title: 'Supabase is not configured yet.',
    setup_hint: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a local .env file and in Vercel. See .env.example for the names.',
    login_intro: 'Please sign in to see the shared ledger.',
    email: 'Email',
    password: 'Password',
    sign_in: 'Sign in',
    login_failed: 'Sign-in failed. Check email or password.',
    login_offline: 'Connection failed. Please try again.',
    nav_main: 'Main navigation',
    nav_overview: 'Overview',
    nav_bookings: 'Bookings',
    nav_employees: 'Employees',
    nav_statement: 'Statement',
    nav_settings: 'Settings',
    menu: 'Open menu',
    shared_ledger: 'Shared ledger',
    shared_ledger_sub: 'Siraj & Chedi · TND',
    current_balance: 'Current balance',
    income_minus_expenses: 'Income minus expenses',
    summary: 'Summary',
    total_income: 'Total income',
    total_expenses: 'Total expenses',
    paid_by_siraj: 'Paid by Siraj',
    paid_by_chedi: 'Paid by Chedi',
    recent_activity: 'Recent activity',
    recent_bookings: 'Recent bookings',
    view_all: 'View all →',
    no_bookings: 'No bookings yet.',
    no_bookings_saved: 'No bookings saved yet.',
    quick_entry: 'Quick entry',
    new_booking: 'New booking',
    type: 'Type',
    type_out: 'Expense',
    type_in: 'Income',
    amount: 'Amount',
    amount_placeholder: 'e.g. 85.500',
    category: 'Category',
    category_placeholder: 'Choose category',
    item: 'Item',
    item_placeholder: 'Choose item',
    item_name: 'Item name',
    item_name_placeholder: 'e.g. Mayonnaise',
    date: 'Date',
    paid_by: 'Paid by',
    paid_siraj: 'Siraj',
    paid_chedi: 'Chedi',
    paid_other: 'Other',
    note: 'Description / note',
    note_optional: 'optional',
    booking_hint: 'No save button: the booking is stored once every required field is set. For the amount, press Enter or leave the field.',
    ledger: 'Ledger',
    saved_bookings: 'Saved bookings',
    save_offline: 'Connection failed. The booking was not saved.',
    save_failed: 'Save failed. The booking was not saved.',
    load_offline: 'Connection failed. Bookings could not be loaded.',
    load_failed: 'Bookings could not be loaded.',
    saved: '{amount} saved',
    remove: 'Remove',
    confirm_remove_booking: 'Remove booking of {amount}?',
    delete_offline: 'Connection failed. The booking was not deleted.',
    delete_failed: 'Delete failed.',
    manage_employees: 'Manage employees',
    employee_name: 'Employee name',
    employee_name_placeholder: 'e.g. Ahmed',
    add: 'Add',
    add_employee_hint: 'Siraj and Chedi see the same list. Chedi and Siraj are not employees automatically.',
    no_employees: 'No employees yet. Add an employee first.',
    employee_empty: 'Please enter a name.',
    employee_duplicate: 'This employee already exists.',
    employee_save_failed: 'The employee could not be saved.',
    employee_delete_failed: 'The employee could not be removed.',
    confirm_remove_employee: 'Remove employee {name}?',
    employees_eyebrow: 'Staff',
    record_advance: 'Record advance',
    employee: 'Employee',
    employee_placeholder: 'Choose employee',
    advance_amount_placeholder: 'e.g. 100.000',
    advance_note: 'Note',
    advance_hint: 'An advance is a normal staff expense in the shared ledger. Saving works like bookings: last required field, Enter, or leave the amount field.',
    advances_by_employee: 'Advances by employee',
    saved_advances: 'Saved advances',
    no_advances: 'No advances saved yet.',
    last_advance: 'Last: {date}',
    no_advance_yet: 'No advance yet',
    history: 'History',
    statement_intro: 'Chronological history of all MixMax bookings in TND.',
    statement_pdf: 'Statement PDF',
    statement_title: 'Statement',
    col_date: 'Date',
    col_type: 'Type',
    col_category: 'Category',
    col_item_advance: 'Item / advance',
    col_paid_by: 'Paid by',
    col_note: 'Description',
    col_amount: 'Amount',
    col_balance: 'Balance',
    income: 'Income',
    expenses: 'Expenses',
    created: 'Created',
    account: 'Account',
    signed_in: 'Signed in',
    sign_out: 'Sign out',
    data: 'Data',
    settings_ledger: 'The source of truth is the Supabase bookings table. Advances are staff expenses in the same table. Old SparBox browser data is not used.',
    settings_currency: 'Currency: Tunisian dinar (TND), 3 decimal places.',
    language: 'Language',
    language_de: 'Deutsch',
    language_en: 'English',
    advance_label: 'Advance',
    pdf_item: 'Item',
    pdf_advance: 'Advance'
  }
};

const categoryLabels = {
  de: {
    'Ware / Einkauf': 'Ware / Einkauf',
    Miete: 'Miete',
    Personal: 'Personal',
    Ausstattung: 'Ausstattung',
    'POS / Kasse': 'POS / Kasse',
    Reparatur: 'Reparatur',
    Transport: 'Transport',
    Sonstiges: 'Sonstiges',
    'Investition / Einlage': 'Investition / Einlage',
    Einnahme: 'Einnahme',
    Rückzahlung: 'Rückzahlung'
  },
  en: {
    'Ware / Einkauf': 'Goods / Purchases',
    Miete: 'Rent',
    Personal: 'Staff',
    Ausstattung: 'Equipment',
    'POS / Kasse': 'POS / Till',
    Reparatur: 'Repair',
    Transport: 'Transport',
    Sonstiges: 'Other',
    'Investition / Einlage': 'Investment / Capital',
    Einnahme: 'Income',
    Rückzahlung: 'Refund'
  }
};

const itemLabels = {
  de: {
    Harissa: 'Harissa',
    Thunfisch: 'Thunfisch',
    Mehl: 'Mehl',
    Eier: 'Eier',
    'Vanille-Sticks': 'Vanille-Sticks',
    Salz: 'Salz',
    Zucker: 'Zucker',
    Cola: 'Cola',
    Fanta: 'Fanta',
    Wasser: 'Wasser',
    Sonstiges: 'Sonstiges'
  },
  en: {
    Harissa: 'Harissa',
    Thunfisch: 'Tuna',
    Mehl: 'Flour',
    Eier: 'Eggs',
    'Vanille-Sticks': 'Vanilla sticks',
    Salz: 'Salt',
    Zucker: 'Sugar',
    Cola: 'Cola',
    Fanta: 'Fanta',
    Wasser: 'Water',
    Sonstiges: 'Other'
  }
};

export function normalizeLang(value) {
  return value === 'en' ? 'en' : DEFAULT_LANG;
}

export function loadLanguage(storage) {
  if (!storage || typeof storage.getItem !== 'function') return DEFAULT_LANG;
  try {
    return normalizeLang(storage.getItem(LANG_KEY));
  } catch {
    return DEFAULT_LANG;
  }
}

export function saveLanguage(lang, storage) {
  const next = normalizeLang(lang);
  if (storage && typeof storage.setItem === 'function') {
    storage.setItem(LANG_KEY, next);
  }
  return next;
}

export function t(lang, key, vars = {}) {
  const code = normalizeLang(lang);
  let text = dictionaries[code][key] ?? dictionaries.de[key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export function categoryLabel(lang, value) {
  const code = normalizeLang(lang);
  return categoryLabels[code][value] || categoryLabels.de[value] || value || '–';
}

export function itemLabel(lang, value) {
  const code = normalizeLang(lang);
  return itemLabels[code][value] || itemLabels.de[value] || value || '–';
}

export function typeLabelI18n(lang, type) {
  return type === 'in' ? t(lang, 'type_in') : type === 'out' ? t(lang, 'type_out') : type || '–';
}

export function paidByLabelI18n(lang, paidBy) {
  if (paidBy === 'siraj') return t(lang, 'paid_siraj');
  if (paidBy === 'chedi') return t(lang, 'paid_chedi');
  if (paidBy === 'other') return t(lang, 'paid_other');
  return paidBy || '–';
}

export function localeFor(lang) {
  return normalizeLang(lang) === 'en' ? 'en-GB' : 'de-DE';
}

export function applyStaticI18n(root, lang) {
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(lang, el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(lang, el.dataset.i18nPlaceholder));
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(lang, el.dataset.i18nAria));
  });
}
