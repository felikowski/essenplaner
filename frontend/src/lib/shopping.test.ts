import { describe, expect, it } from 'vitest'
import type { ShoppingList } from '../types'
import { describeSource, groupByCategory, shareText, visibleUnder } from './shopping'

const list: ShoppingList = {
  version: 1,
  categories: [
    { id: 'gemuese', name: 'Obst & Gemüse', removable: true },
    { id: 'milch', name: 'Milchprodukte & Eier', removable: true },
    { id: 'sonst', name: 'Sonstiges', removable: false },
  ],
  stores: [{ id: 'markt', name: 'Wochenmarkt' }],
  items: [
    { id: '1', name: 'Zwiebeln', categoryId: 'gemuese', checked: false, display: '4', amounts: [], sources: [] },
    { id: '2', name: 'Äpfel', categoryId: 'gemuese', storeId: 'markt', checked: false, display: '1 kg', amounts: [], sources: [] },
    { id: '3', name: 'Milch', categoryId: 'milch', checked: true, amounts: [], sources: [] },
    { id: '4', name: 'Salz', categoryId: 'sonst', checked: false, amounts: [], sources: [] },
  ],
}

describe('Einkaufsliste', () => {
  it('erzeugt den Text zum Teilen nach Kategorien, ohne erledigte Artikel', () => {
    expect(shareText(list)).toBe('Obst & Gemüse\n- Zwiebeln: 4\n- Äpfel: 1 kg\n\nSonstiges\n- Salz')
  })

  it('beachtet beim Teilen den Geschäftsfilter', () => {
    expect(shareText(list, 'anderes')).toBe('Obst & Gemüse\n- Zwiebeln: 4\n\nSonstiges\n- Salz')
  })

  it('zeigt Artikel ohne Geschäft unter jedem Filter', () => {
    expect(visibleUnder(list.items[0], 'markt')).toBe(true)
    expect(visibleUnder(list.items[1], 'anderes')).toBe(false)
    expect(visibleUnder(list.items[1], null)).toBe(true)
  })

  it('lässt leere Kategorien weg', () => {
    expect(groupByCategory(list, [list.items[3]]).map((group) => group.category.name)).toEqual(['Sonstiges'])
  })

  it('beschreibt die Herkunft', () => {
    expect(describeSource({ kind: 'plan', recipeTitle: 'Linsensuppe', date: '2026-10-02', amount: '2' }, 'Karotten')).toBe(
      'Linsensuppe (Fr 02.10.): 2 Karotten',
    )
    expect(describeSource({ kind: 'plan', date: '2026-10-03', amount: '1', text: '1 Baguette' }, 'Baguette')).toBe(
      'Einzelzutat (Sa 03.10.): 1 Baguette',
    )
    expect(describeSource({ kind: 'staple', text: 'Kaffee' }, 'Kaffee')).toBe('Vorrat: Kaffee')
    expect(describeSource({ kind: 'manual', text: '2 Packungen Kaffee', amount: '2 Pck.' }, 'Kaffee')).toBe(
      'Selbst hinzugefügt: 2 Packungen Kaffee',
    )
  })
})
