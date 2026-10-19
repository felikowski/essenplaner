import type { ShoppingCategory, ShoppingItem, ShoppingList, ShoppingSource } from '../types'
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

/** Herkunft eines Anteils, etwa „Linsensuppe (Fr 02.10.): 2 Karotten · Felix“. */
export function describeSource(source: ShoppingSource, itemName: string): string {
  const by = source.addedBy ? ` · ${displayName(source.addedBy)}` : ''
  return describeOrigin(source, itemName) + by
}

function describeOrigin(source: ShoppingSource, itemName: string): string {
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

/** Anzeigename mit großem Anfangsbuchstaben: „felix“ → „Felix“. */
export function displayName(name: string): string {
  return name.charAt(0).toLocaleUpperCase('de') + name.slice(1)
}

/** Wer die Anteile eingetragen hat, ohne Doppelungen in der Reihenfolge des Hinzufügens: „Felix, Linh“. */
export function addedByNames(sources: ShoppingSource[]): string {
  return [...new Set(sources.flatMap((source) => (source.addedBy ? [displayName(source.addedBy)] : [])))].join(', ')
}

export type SourceKind = ShoppingSource['kind']

export const SOURCE_GROUPS: { kind: SourceKind; title: string }[] = [
  { kind: 'plan', title: 'Aus Rezepten' },
  { kind: 'manual', title: 'Selbst eingetragen' },
  { kind: 'staple', title: 'Vorrat' },
]

export interface SourceEntry {
  item: ShoppingItem
  /** Menge der Anteile dieser Herkunft */
  display?: string
  /** Wer die Anteile dieser Herkunft eingetragen hat */
  names: string
}

/**
 * Gruppiert Artikel nach Herkunft. Ein Artikel mit Anteilen aus mehreren Quellen steht in jeder davon,
 * jeweils mit deren Menge. Innerhalb einer Gruppe: Kategorie-Reihenfolge, offen vor erledigt, Name.
 */
export function groupBySource(
  list: ShoppingList,
  items: ShoppingItem[] = list.items,
): { kind: SourceKind; title: string; entries: SourceEntry[] }[] {
  const position = new Map(list.categories.map((category: ShoppingCategory, index) => [category.id, index]))
  const sorted = [...items].sort(
    (a, b) =>
      (position.get(a.categoryId) ?? 0) - (position.get(b.categoryId) ?? 0) ||
      Number(a.checked) - Number(b.checked) ||
      a.name.localeCompare(b.name, 'de'),
  )
  return SOURCE_GROUPS.map(({ kind, title }) => ({
    kind,
    title,
    entries: sorted.flatMap((item) => {
      const sources = item.sources.filter((source) => source.kind === kind)
      if (sources.length === 0) return []
      return [{ item, display: item.sourceDisplay?.[kind] || undefined, names: addedByNames(sources) }]
    }),
  })).filter((group) => group.entries.length > 0)
}
