import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANG,
  LANG_KEY,
  categoryLabel,
  loadLanguage,
  normalizeLang,
  paidByLabelI18n,
  saveLanguage,
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

  it('switches DE to EN immediately via t()', () => {
    expect(t('en', 'nav_overview')).toBe('Overview');
    expect(t('en', 'nav_bookings')).toBe('Bookings');
    expect(t('en', 'current_balance')).toBe('Current balance');
  });

  it('persists language choice', () => {
    const storage = memoryStorage();
    expect(saveLanguage('en', storage)).toBe('en');
    expect(storage.getItem(LANG_KEY)).toBe('en');
    expect(loadLanguage(storage)).toBe('en');
  });

  it('falls back to German for unknown languages and missing keys', () => {
    expect(normalizeLang('fr')).toBe('de');
    expect(loadLanguage(memoryStorage({ [LANG_KEY]: 'es' }))).toBe('de');
    expect(t('en', 'nav_overview')).toBe('Overview');
    expect(t('de', 'missing_key_xyz')).toBe('missing_key_xyz');
  });

  it('keeps internal values stable across languages', () => {
    expect(typeLabelI18n('de', 'out')).toBe('Ausgabe');
    expect(typeLabelI18n('en', 'out')).toBe('Expense');
    expect(paidByLabelI18n('en', 'chedi')).toBe('Chedi');
    expect(paidByLabelI18n('de', 'other')).toBe('Andere');
    expect(categoryLabel('en', 'Ware / Einkauf')).toBe('Goods / Purchases');
    expect(categoryLabel('de', 'Ware / Einkauf')).toBe('Ware / Einkauf');
  });
});
