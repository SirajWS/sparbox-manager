import { describe, expect, it } from 'vitest';
import { CUSTOM_ITEM, CUSTOM_SOURCE, PURCHASE_ITEMS, PURCHASE_SOURCES } from './catalog.js';
import { itemLabel } from './i18n.js';

describe('purchase catalog', () => {
  it('keeps one list with existing and new articles', () => {
    expect(PURCHASE_ITEMS).toEqual([
      'Harissa',
      'Thunfisch',
      'mushrooms',
      'processed_cheese',
      'other_cheese',
      'mozzarella',
      'semolina',
      'yeast',
      'margarine',
      'oil',
      'vanilla_sugar',
      'Vanille-Sticks',
      'Mehl',
      'Eier',
      'gruyere',
      'vanilla_paste',
      'soft_drinks',
      'Wasser',
      'sweets',
      'Salz',
      'Zucker',
      'Sonstiges'
    ]);
    expect(PURCHASE_ITEMS[PURCHASE_ITEMS.length - 1]).toBe(CUSTOM_ITEM);
    expect(PURCHASE_ITEMS).toContain('Thunfisch');
    expect(PURCHASE_ITEMS).not.toContain('Cola');
  });

  it('translates catalog labels without renaming stored ids', () => {
    expect(itemLabel('de', 'Thunfisch')).toBe('Thunfisch');
    expect(itemLabel('en', 'Thunfisch')).toBe('Tuna');
    expect(itemLabel('fr', 'Thunfisch')).toBe('Thon');
    expect(itemLabel('de', 'mushrooms')).toBe('Champignons');
    expect(itemLabel('en', 'mushrooms')).toBe('Mushrooms');
    expect(itemLabel('fr', 'mushrooms')).toBe('Champignons');
    expect(itemLabel('de', 'processed_cheese')).toBe('Schmelzkäse / Portionskäse');
    expect(itemLabel('en', 'processed_cheese')).toBe('Processed cheese');
    expect(itemLabel('fr', 'processed_cheese')).toBe('Fromage fondu / portions');
    expect(itemLabel('en', 'soft_drinks')).toBe('Soft drinks');
    expect(itemLabel('fr', 'soft_drinks')).toBe('Boissons gazeuses');
    expect(itemLabel('de', 'sweets')).toBe('Süßigkeiten');
    expect(itemLabel('en', 'sweets')).toBe('Sweets');
    expect(itemLabel('fr', 'sweets')).toBe('Confiseries');
    expect(itemLabel('fr', 'Vanille-Sticks')).toBe('Bâtons de vanille');
    expect(itemLabel('en', 'Cola')).toBe('Cola');
  });

  it('offers known shops plus a free-text other option', () => {
    expect(PURCHASE_SOURCES).toContain('Aziza');
    expect(PURCHASE_SOURCES).toContain('Superette El Hadj');
    expect(PURCHASE_SOURCES.at(-1)).toBe(CUSTOM_SOURCE);
  });
});
