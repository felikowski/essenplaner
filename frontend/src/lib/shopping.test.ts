import { describe, expect, it } from 'vitest'
import type { ShoppingItem, ShoppingList } from '../types'
import { addedByNames, describeSource, groupByCategory, groupBySource, shareText, visibleUnder } from './shopping'

const list: ShoppingList = {
  version: 1,
  categories: [
    { id: 'gemuese', name: 'Obst & Gemüse', removable: true },
    { id: 'milch', name: 'Milchprodukte & Eier', removable: true },
    { id: 'sonst', name: 'Sonstiges', removable: false },
  ],
  stores: [{ id: 'markt', name: 'Wochenmarkt' }],
  items: [
    { id: '1', name: 'Zwiebeln', categoryId: 'gemuese', checked: false, display: '4', amounts: [], sources: [], sourceDisplay: {} },
    { id: '2', name: 'Äpfel', categoryId: 'gemuese', storeId: 'markt', checked: false, display: '1 kg', amounts: [], sources: [], sourceDisplay: {} },
    { id: '3', name: 'Milch', categoryId: 'milch', checked: true, amounts: [], sources: [], sourceDisplay: {} },
    { id: '4', name: 'Salz', categoryId: 'sonst', checked: false, amounts: [], sources: [], sourceDisplay: {} },
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

  it('hängt die Person an die Herkunft', () => {
    expect(
      describeSource({ kind: 'plan', recipeTitle: 'Linsensuppe', date: '2026-10-02', amount: '2', addedBy: 'felix' }, 'Karotten'),
    ).toBe('Linsensuppe (Fr 02.10.): 2 Karotten · Felix')
  })

  it('nennt jede Person einmal, in der Reihenfolge des Hinzufügens', () => {
    expect(
      addedByNames([
        { kind: 'manual', addedBy: 'felix' },
        { kind: 'plan' },
        { kind: 'manual', addedBy: 'linh' },
        { kind: 'plan', addedBy: 'felix' },
      ]),
    ).toBe('Felix, Linh')
    expect(addedByNames([{ kind: 'manual' }])).toBe('')
  })

  it('teilt die Liste nach Herkunft auf', () => {
    const butter: ShoppingItem = {
      id: 'b',
      name: 'Butter',
      categoryId: 'milch',
      checked: false,
      display: '250 g + 2 EL',
      amounts: [],
      sources: [
        { kind: 'plan', recipeTitle: 'Kuchen', addedBy: 'felix' },
        { kind: 'manual', addedBy: 'linh' },
      ],
      sourceDisplay: { plan: '250 g', manual: '2 EL' },
    }
    const kaffee: ShoppingItem = {
      id: 'k',
      name: 'Kaffee',
      categoryId: 'sonst',
      checked: false,
      amounts: [],
      sources: [{ kind: 'manual' }],
      sourceDisplay: { manual: '' },
    }
    const karotten: ShoppingItem = { ...kaffee, id: 'c', name: 'Karotten', categoryId: 'gemuese', checked: true, sources: [{ kind: 'plan' }] }
    const groups = groupBySource({ ...list, items: [kaffee, butter, karotten] })

    expect(groups.map((group) => group.title)).toEqual(['Aus Rezepten', 'Selbst eingetragen'])
    expect(groups[0].entries.map((entry) => [entry.item.name, entry.display, entry.names])).toEqual([
      ['Karotten', undefined, ''],
      ['Butter', '250 g', 'Felix'],
    ])
    expect(groups[1].entries.map((entry) => [entry.item.name, entry.display, entry.names])).toEqual([
      ['Butter', '2 EL', 'Linh'],
      ['Kaffee', undefined, ''],
    ])
  })
})
