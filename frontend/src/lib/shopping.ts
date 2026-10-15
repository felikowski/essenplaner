import type { ShoppingItem, ShoppingList, ShoppingSource } from '../types'
import { formatShortDate } from './isoWeek'

/** Ein Artikel ist unter einem Geschäftsfilter sichtbar, wenn er diesem oder keinem Geschäft zugeordnet ist. */
export function visibleUnder(item: ShoppingItem, storeId: string | null): boolean {
  return storeId === null || !item.storeId || item.storeId === storeId
}

/** Gruppiert Artikel in der Reihenfolge der Kategorien; leere Kategorien fallen weg. */
export function groupByCategory(list: ShoppingList, items: ShoppingItem[] = list.items) {
  return list.categories
    .map((category) => ({ category, items: items.filter((item) => item.categoryId === category.id) }))
    .filter((group) => group.items.length > 0)
}

/** „Zwiebeln: 4“ oder nur „Salz“ */
export function itemLine(item: ShoppingItem): string {
  return item.display ? `${item.name}: ${item.display}` : item.name
}

/** Text zum Teilen: offene Artikel nach Kategorien, etwa „Obst & Gemüse\n- Zwiebeln: 4“. */
export function shareText(list: ShoppingList, storeId: string | null = null): string {
  const open = list.items.filter((item) => !item.checked && visibleUnder(item, storeId))
  return groupByCategory(list, open)
    .map(({ category, items }) => [category.name, ...items.map((item) => `- ${itemLine(item)}`)].join('\n'))
    .join('\n\n')
}

/** Herkunft eines Anteils, etwa „Linsensuppe (Fr 02.10.): 2 Karotten“. */
export function describeSource(source: ShoppingSource, itemName: string): string {
  const what = source.amount ? `${source.amount} ${itemName}` : itemName
  const date = source.date ? ` (${formatShortDate(source.date)})` : ''
  switch (source.kind) {
    case 'plan':
      return `${source.recipeTitle ?? 'Einzelzutat'}${date}: ${source.recipeTitle ? what : (source.text ?? what)}`
    case 'staple':
      return `Vorrat: ${source.text ?? what}`
    default:
      return `Selbst hinzugefügt: ${source.text || what}`
  }
}
