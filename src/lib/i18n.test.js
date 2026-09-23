import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANG,
  LANG_KEY,
  categoryLabel,
  loadLanguage,
  localeFor,
  monthShortLabel,
  normalizeLang,
  paidByLabelI18n,
  saveLanguage,
  staffKindLabel,
  t,
  typeLabelI18n
} from './i18n.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); }
  };
}

describe('i18n', () => {
  it('defaults to German', () => {
    expect(DEFAULT_LANG).toBe('de');
    expect(loadLanguage(memoryStorage())).toBe('de');
    expect(t('de', 'nav_overview')).toBe('Übersicht');
  });

  it('switches DE, EN and FR immediately via t()', () => {
    expect(t('en', 'nav_overview')).toBe('Overview');
    expect(t('fr', 'nav_overview')).toBe('Aperçu');
    expect(t('en', 'nav_bookings')).toBe('Bookings');
    expect(t('fr', 'nav_bookings')).toBe('Écritures');
    expect(t('fr', 'current_balance')).toBe('Solde actuel');
    expect(t('fr', 'record_staff_payment')).toBe('Enregistrer un paiement du personnel');
    expect(t('en', 'record_staff_payment')).toBe('Record staff payment');
    expect(t('de', 'record_staff_payment')).toBe('Personalzahlung erfassen');
  });

  it('persists language choice including French', () => {
    const storage = memoryStorage();
    expect(saveLanguage('en', storage)).toBe('en');
    expect(storage.getItem(LANG_KEY)).toBe('en');
    expect(loadLanguage(storage)).toBe('en');
    expect(saveLanguage('fr', storage)).toBe('fr');
    expect(storage.getItem(LANG_KEY)).toBe('fr');
    expect(loadLanguage(storage)).toBe('fr');
    expect(saveLanguage('de', storage)).toBe('de');
    expect(loadLanguage(storage)).toBe('de');
  });

  it('falls back to German for unknown languages and missing keys', () => {
    expect(normalizeLang('es')).toBe('de');
    expect(normalizeLang('fr')).toBe('fr');
    expect(loadLanguage(memoryStorage({ [LANG_KEY]: 'es' }))).toBe('de');
    expect(t('en', 'nav_overview')).toBe('Overview');
    expect(t('de', 'missing_key_xyz')).toBe('missing_key_xyz');
  });

  it('keeps internal values stable across languages', () => {
    expect(typeLabelI18n('de', 'out')).toBe('Ausgabe');
    expect(typeLabelI18n('en', 'out')).toBe('Expense');
    expect(typeLabelI18n('fr', 'out')).toBe('Dépense');
    expect(paidByLabelI18n('en', 'chedi')).toBe('Chedi');
    expect(paidByLabelI18n('de', 'other')).toBe('Andere');
    expect(paidByLabelI18n('fr', 'other')).toBe('Autre');
    expect(categoryLabel('en', 'Ware / Einkauf')).toBe('Goods / Purchases');
    expect(categoryLabel('fr', 'Personal')).toBe('Personnel');
    expect(categoryLabel('de', 'Ware / Einkauf')).toBe('Ware / Einkauf');
    expect(staffKindLabel('de', 'salary')).toBe('Gehalt');
    expect(staffKindLabel('en', 'employee_advance')).toBe('Advance');
    expect(staffKindLabel('fr', 'tip')).toBe('Pourboire');
    expect(staffKindLabel('de', 'other_staff')).toBe('Sonstiges');
    expect(staffKindLabel('en', 'other_staff')).toBe('Other');
    expect(staffKindLabel('fr', 'other_staff')).toBe('Divers');
    expect(staffKindLabel('fr', 'salary')).toBe('Salaire');
    expect(staffKindLabel('de', 'employee_advance')).toBe('Vorschuss');
    expect(monthShortLabel('de', 3)).toBe('Mär');
    expect(monthShortLabel('en', 3)).toBe('Mar');
    expect(monthShortLabel('fr', 8)).toBe('Août');
    expect(localeFor('fr')).toBe('fr-FR');
  });

  it('translates add, edit and delete labels in DE/EN/FR', () => {
    expect(t('de', 'add_booking')).toBe('Buchung hinzufügen');
    expect(t('en', 'add_booking')).toBe('Add entry');
    expect(t('fr', 'add_booking')).toBe('Ajouter l’écriture');
    expect(t('de', 'edit')).toBe('Bearbeiten');
    expect(t('en', 'edit')).toBe('Edit');
    expect(t('fr', 'edit')).toBe('Modifier');
    expect(t('en', 'remove')).toBe('Delete');
    expect(t('fr', 'remove')).toBe('Supprimer');
    expect(t('de', 'confirm_remove_booking')).toBe('Möchtest du diese Buchung wirklich löschen?');
    expect(t('en', 'confirm_remove_booking')).toBe('Do you really want to delete this entry?');
    expect(t('fr', 'confirm_remove_booking')).toBe('Voulez-vous vraiment supprimer cette écriture ?');
    expect(t('de', 'save_changes')).toBe('Änderungen speichern');
    expect(t('en', 'save_changes')).toBe('Save changes');
    expect(t('fr', 'save_changes')).toBe('Enregistrer les modifications');
  });

  it('translates PDF labels without changing stored values', () => {
    expect(t('de', 'staff_pdf_title')).toBe('Personal-Zahlungsnachweis');
    expect(t('en', 'staff_pdf_title')).toBe('Staff Payment Statement');
    expect(t('fr', 'staff_pdf_title')).toBe('Relevé des paiements du personnel');
    expect(t('de', 'statement_title')).toBe('Kontoauszug');
    expect(t('fr', 'col_item_desc')).toBe('Article / description');
    expect(t('de', 'col_purchase_desc')).toBe('Einkauf / Beschreibung');
    expect(t('en', 'col_shop_source')).toBe('Shop / Source');
    expect(t('fr', 'col_shop_source')).toBe('Magasin / Source');
    expect(t('de', 'col_description')).toBe('Beschreibung');
    expect(t('en', 'col_description')).toBe('Description');
    expect(t('fr', 'col_description')).toBe('Description');
    expect(t('de', 'col_paid_by')).toBe('Bezahlt von');
    expect(t('en', 'current_balance')).toBe('Current balance');
    expect(t('de', 'payment_details')).toBe('Zahlungsdetails');
    expect(t('en', 'payment_details')).toBe('Payment details');
    expect(t('fr', 'payment_details')).toBe('Détail des paiements');
    expect(t('de', 'salary_overview')).toBe('Gehaltsübersicht');
    expect(t('en', 'sign_employee')).toBe('Employee');
    expect(t('fr', 'sign_management')).toBe('Gestion');
    expect(t('de', 'shared_ledger_status')).toBe('Gemeinsames Buch · TND');
    expect(t('en', 'shared_ledger_status')).toBe('Shared ledger · TND');
    expect(t('fr', 'shared_ledger_status')).toBe('Livre commun · TND');
    expect(t('de', 'shared_ledger_status')).not.toMatch(/Siraj|Chedi/);
    expect(t('de', 'hide_balance')).toBe('Saldo ausblenden');
    expect(t('en', 'show_balance')).toBe('Show balance');
    expect(t('fr', 'hide_balance')).toBe('Masquer le solde');
    expect(t('fr', 'show_balance')).toBe('Afficher le solde');
    expect(t('de', 'balance_trend')).toBe('Saldoentwicklung');
    expect(t('en', 'balance_trend')).toBe('Balance trend');
    expect(t('fr', 'balance_trend')).toBe('Évolution du solde');
    expect(t('de', 'purchase_source')).toBe('Geschäft / Einkaufsquelle');
    expect(t('en', 'purchase_source')).toBe('Shop / Source');
    expect(t('fr', 'purchase_source')).toMatch(/Magasin \/ Source d/);
  });
});
