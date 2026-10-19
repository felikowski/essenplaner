import { parseIngredient } from '../lib/ingredient'
import type {
  IsoDate,
  PlanEntry,
  Recipe,
  ShoppingAlias,
  ShoppingImportResult,
  ShoppingItem,
  ShoppingItemPatch,
  ShoppingLinePreview,
  ShoppingList,
  ShoppingSource,
  Staple,
} from '../types'
import { RequestError } from './request'

/**
 * Einkaufsliste im Speicher für MockPlannerApi. Bildet die Regeln des Backends
 * (internal/store/shopping.go, internal/quantity) vereinfacht nach; die Vorschläge kennen nur wenige Zutaten.
 */

interface Part {
  quantity?: number
  unit?: string
  source: ShoppingSource
}

interface StoredItem {
  id: string
  key: string
  name: string
  categoryId: string
  storeId?: string
  checked: boolean
  parts: Part[]
}

interface StoredStaple extends Staple {
  key: string
}

/** Wer in der Mock-API etwas einträgt; derselbe Name wie bei getMe. */
const MOCK_USER = 'Familie'

export type PlanSnapshot = () => Promise<{ recipes: Recipe[]; entries: (PlanEntry & { date: IsoDate })[] }>

const BUILTIN = [
  ['obst-gemuese', 'Obst & Gemüse'],
  ['brot', 'Brot & Backwaren'],
  ['milch', 'Milchprodukte & Eier'],
  ['kaese', 'Käse'],
  ['fleisch', 'Fleisch & Fisch'],
  ['tiefkuehl', 'Tiefkühl'],
  ['getreide', 'Nudeln, Reis & Getreide'],
  ['konserven', 'Konserven & Saucen'],
  ['backen', 'Backen'],
  ['gewuerze', 'Gewürze & Öle'],
  ['suesses', 'Süßes & Snacks'],
  ['getraenke', 'Getränke'],
  ['drogerie', 'Drogerie & Haushalt'],
  ['sonstiges', 'Sonstiges'],
] as const

const SUGGESTIONS: Record<string, string> = {
  zwiebel: 'obst-gemuese', zwiebeln: 'obst-gemuese', zucchini: 'obst-gemuese', karotten: 'obst-gemuese',
  kartoffeln: 'obst-gemuese', äpfel: 'obst-gemuese', paprika: 'obst-gemuese', lauch: 'obst-gemuese',
  baguette: 'brot', brot: 'brot', milch: 'milch', butter: 'milch', eier: 'milch', feta: 'kaese',
  tellerlinsen: 'getreide', reis: 'getreide', nudeln: 'getreide', mehl: 'backen', salz: 'gewuerze',
  kaffee: 'getraenke', spülmittel: 'drogerie', gemüsebrühe: 'konserven', kokosmilch: 'konserven',
}

const CONVERTIBLE: Record<string, [string, number]> = {
  mg: ['g', 0.001], g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000],
}
const COUNTABLE = new Set(['Stück', 'Dose', 'Pck.', 'Bund', 'Zehe', 'Kopf', 'Glas', 'Becher', 'Stange', 'Würfel'])

export function shoppingKey(name: string): string {
  return name.trim().split(/\s+/).join(' ').toLowerCase()
}

/** Summiert Mengen wie internal/quantity. */
export function sumAmounts(parts: { quantity?: number; unit?: string }[]): { quantity: number; unit?: string }[] {
  const totals = new Map<string, number>()
  for (const part of parts) {
    if (part.quantity === undefined) continue
    let unit = part.unit ?? ''
    let value = part.quantity
    const convertible = CONVERTIBLE[unit]
    if (convertible) {
      unit = convertible[0]
      value *= convertible[1]
    }
    totals.set(unit, (totals.get(unit) ?? 0) + value)
  }
  return [...totals].map(([unit, value]) => {
    if (unit === 'g' || unit === 'ml') {
      if (Math.round(value) >= 1000) return { quantity: Math.round(value / 100) / 10, unit: unit === 'g' ? 'kg' : 'l' }
      return { quantity: Math.max(1, Math.round(value)), unit }
    }
    if (unit === '' || COUNTABLE.has(unit)) {
      const rounded = Math.max(1, Math.ceil(value - 1e-9))
      return unit ? { quantity: rounded, unit } : { quantity: rounded }
    }
    return { quantity: Math.max(0.5, Math.round(value * 2) / 2), unit }
  })
}

function formatNumber(value: number): string {
  const whole = Math.floor(value + 1e-9)
  if (Math.abs(value - whole - 0.5) < 1e-9) return whole === 0 ? '½' : `${whole}½`
  return String(Math.round(value * 10) / 10).replace('.', ',')
}

export function formatAmounts(groups: { quantity: number; unit?: string }[]): string {
  return groups.map((g) => (g.unit ? `${formatNumber(g.quantity)} ${g.unit}` : formatNumber(g.quantity))).join(' + ')
}

function invalid(message: string): RequestError {
  return new RequestError('fehlgeschlagen: 422', 422, message)
}

function notFound(): RequestError {
  return new RequestError('fehlgeschlagen: 404', 404, 'not found')
}

function checkName(text: string, max: number, what: string): string {
  const trimmed = text.trim().split(/\s+/).join(' ')
  if (!trimmed || trimmed.length > max) throw invalid(`${what} muss 1 bis ${max} Zeichen lang sein.`)
  return trimmed
}

const MAX_LINES = 50

function checkLines(texts: string[]): string[] {
  if (texts.length === 0 || texts.length > MAX_LINES) throw invalid(`Es lassen sich 1 bis ${MAX_LINES} Artikel auf einmal hinzufügen.`)
  return texts.map((text, index) => {
    try {
      return checkName(text, 200, 'Der Artikel')
    } catch (error) {
      throw invalid(`Zeile ${index + 1}: ${(error as RequestError).serverMessage}`)
    }
  })
}

const NUMBER_WORDS: Record<string, string> = {
  ein: '1', eine: '1', einen: '1', zwei: '2', drei: '3', vier: '4', fünf: '5', sechs: '6', sieben: '7', acht: '8',
  neun: '9', zehn: '10', zwölf: '12',
}
const FILLER = /^(?:noch|bitte|wir brauchen|brauchen|außerdem|dann|auch)\s+/i

/**
 * Zerlegt eine Ansage ohne Sprachmodell, damit Tests und der Mock-Modus ohne Netz laufen:
 * an Zeilenumbrüchen, Kommas und „und“, mit Zahlwörtern als Ziffern und ohne einfache Füllwörter.
 */
export function splitShoppingText(text: string): string[] {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of text.split(/\n|,|;|\s+und\s+/)) {
    let line = raw.trim().split(/\s+/).join(' ')
    while (FILLER.test(line)) line = line.replace(FILLER, '')
    line = line
      .replace(/^(\p{L}+)\s/u, (match, word: string) => (NUMBER_WORDS[word.toLowerCase()] ? `${NUMBER_WORDS[word.toLowerCase()]} ` : match))
      .replace(/^(\d+(?:[.,]\d+)?)([a-zA-Z]+)\b/, '$1 $2')
      .replace(/[.!?]+$/, '')
    if (!line) continue
    const key = shoppingKey(parseIngredient(line).name || line)
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(line.slice(0, 200))
    if (lines.length === MAX_LINES) break
  }
  return lines
}

export class MockShopping {
  private version = 1
  private categories: { id: string; slug?: string; name: string; position: number }[] = BUILTIN.map(
    ([slug, name], index) => ({ id: `cat-${slug}`, slug, name, position: index + 1 }),
  )
  private stores: { id: string; name: string }[] = []
  private items: StoredItem[] = []
  private aliases = new Map<string, { fromName: string; toKey: string; toName: string }>()
  private prefs = new Map<string, { categoryId?: string; storeId?: string }>()
  private staples: StoredStaple[] = []
  private imported = new Set<string>()
  private nextId = 1
  private readonly plan: PlanSnapshot

  constructor(plan: PlanSnapshot) {
    this.plan = plan
  }

  list(knownVersion?: number): ShoppingList | null {
    if (knownVersion === this.version) return null
    return this.snapshot()
  }

  addItem(text: string): ShoppingList {
    const line = checkName(text, 200, 'Der Artikel')
    const parsed = parseIngredient(line)
    this.addPart(parsed.name, { quantity: parsed.quantity, unit: parsed.unit, source: { kind: 'manual', text: line } })
    return this.changed()
  }

  /** Wie internal/store PreviewShoppingLines: prüft alle Zeilen und zeigt, wohin sie kämen. */
  previewLines(texts: string[]): ShoppingLinePreview[] {
    const earlier = new Map<string, ShoppingLinePreview>()
    return checkLines(texts).map((text) => {
      const name = parseIngredient(text).name.trim().split(/\s+/).join(' ')
      const preview: ShoppingLinePreview = { text, name, categoryId: '', category: '', mergesInto: null }
      if (!name) return preview
      const place = this.place(name)
      preview.name = place.name
      const first = earlier.get(place.key)
      if (place.item) {
        preview.categoryId = place.item.categoryId
        preview.mergesInto = place.item.name
      } else if (first) {
        preview.categoryId = first.categoryId
        preview.mergesInto = first.name
      } else {
        preview.categoryId = place.categoryId
        earlier.set(place.key, preview)
      }
      preview.category = this.categories.find((c) => c.id === preview.categoryId)?.name ?? ''
      return preview
    })
  }

  addItems(texts: string[]): ShoppingList {
    for (const line of checkLines(texts)) {
      const parsed = parseIngredient(line)
      this.addPart(parsed.name, { quantity: parsed.quantity, unit: parsed.unit, source: { kind: 'manual', text: line } })
    }
    return this.changed()
  }

  updateItem(id: string, patch: ShoppingItemPatch): ShoppingList {
    const item = this.find(id)
    if (patch.quantity !== undefined) {
      const text = patch.quantity.trim()
      let part: Part = { source: { kind: 'manual', text } }
      if (text) {
        const parsed = parseIngredient(`${text} x`)
        if (parsed.quantity === undefined || parsed.name !== 'x') {
          throw invalid('Die Menge wurde nicht erkannt, zum Beispiel „500 g“ oder „2“.')
        }
        part = { quantity: parsed.quantity, unit: parsed.unit, source: { kind: 'manual', text } }
      }
      part.source.addedBy = MOCK_USER
      item.parts = [part]
    }
    if (patch.categoryId !== undefined) {
      if (!this.categories.some((c) => c.id === patch.categoryId)) throw invalid('Diese Kategorie gibt es nicht.')
      item.categoryId = patch.categoryId
      this.prefs.set(item.key, { ...this.prefs.get(item.key), categoryId: patch.categoryId })
    }
    if (patch.storeId !== undefined) {
      if (patch.storeId !== null && !this.stores.some((s) => s.id === patch.storeId)) {
        throw invalid('Dieses Geschäft gibt es nicht.')
      }
      item.storeId = patch.storeId ?? undefined
      this.prefs.set(item.key, { ...this.prefs.get(item.key), storeId: patch.storeId ?? undefined })
    }
    if (patch.name !== undefined) {
      const name = checkName(patch.name, 200, 'Der Name')
      const key = shoppingKey(name)
      const other = item.checked ? undefined : this.items.find((c) => c.key === key && !c.checked && c.id !== id)
      if (other) {
        other.parts.push(...item.parts)
        this.items = this.items.filter((c) => c !== item)
      } else {
        item.name = name
        item.key = key
      }
    }
    return this.changed()
  }

  setChecked(id: string, checked: boolean): ShoppingList {
    this.find(id).checked = checked
    return this.changed()
  }

  deleteItem(id: string): ShoppingList {
    const item = this.find(id)
    this.items = this.items.filter((candidate) => candidate !== item)
    return this.changed()
  }

  merge(id: string, targetId: string): ShoppingList {
    if (id === targetId) throw invalid('Ein Artikel lässt sich nicht mit sich selbst zusammenführen.')
    const source = this.find(id)
    const target = this.find(targetId)
    target.parts.push(...source.parts)
    this.items = this.items.filter((item) => item !== source)
    if (source.key !== target.key) {
      for (const alias of this.aliases.values()) {
        if (alias.toKey === source.key) Object.assign(alias, { toKey: target.key, toName: target.name })
      }
      this.aliases.delete(target.key)
      this.aliases.set(source.key, { fromName: source.name, toKey: target.key, toName: target.name })
    }
    return this.changed()
  }

  async importFromPlan(from: IsoDate, to: IsoDate): Promise<ShoppingImportResult> {
    if (to < from) throw invalid('Das Ende des Zeitraums liegt vor dem Anfang.')
    const { recipes, entries } = await this.plan()
    const withoutIngredients: ShoppingImportResult['withoutIngredients'] = []
    const inRange = entries
      .filter((entry) => entry.date >= from && entry.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
    for (const entry of inRange) {
      if ((entry.kind !== 'recipe' && entry.kind !== 'item') || this.imported.has(entry.id)) continue
      if (entry.kind === 'item') {
        const parsed = parseIngredient(entry.text ?? '')
        this.addPart(parsed.name, {
          quantity: parsed.quantity,
          unit: parsed.unit,
          source: { kind: 'plan', date: entry.date, text: entry.text },
        })
      } else {
        const recipe = recipes.find((candidate) => candidate.id === entry.recipeId)
        if (!recipe) continue
        if (!recipe.ingredients?.length) {
          if (!withoutIngredients.some((r) => r.id === recipe.id)) withoutIngredients.push({ id: recipe.id, title: recipe.title })
          continue
        }
        const factor = entry.servings && recipe.servings ? entry.servings / recipe.servings : 1
        for (const ingredient of recipe.ingredients) {
          this.addPart(ingredient.name, {
            quantity: ingredient.quantity === undefined ? undefined : ingredient.quantity * factor,
            unit: ingredient.unit,
            source: { kind: 'plan', recipeId: recipe.id, recipeTitle: recipe.title, date: entry.date, text: ingredient.text },
          })
        }
      }
      this.imported.add(entry.id)
    }
    return { list: this.changed(), withoutIngredients }
  }

  clearChecked(): ShoppingList {
    this.items = this.items.filter((item) => !item.checked)
    return this.changed()
  }

  createCategory(name: string): ShoppingList {
    const checked = checkName(name, 60, 'Der Name')
    this.categories.push({ id: `cat-${this.nextId++}`, name: checked, position: this.categories.length + 1 })
    return this.changed()
  }

  renameCategory(id: string, name: string): ShoppingList {
    const category = this.categories.find((c) => c.id === id)
    if (!category) throw notFound()
    category.name = checkName(name, 60, 'Der Name')
    return this.changed()
  }

  deleteCategory(id: string): ShoppingList {
    if (id === 'cat-sonstiges') throw invalid('„Sonstiges“ lässt sich nicht löschen.')
    if (!this.categories.some((c) => c.id === id)) throw notFound()
    this.categories = this.categories.filter((c) => c.id !== id)
    for (const item of this.items) if (item.categoryId === id) item.categoryId = 'cat-sonstiges'
    for (const pref of this.prefs.values()) if (pref.categoryId === id) delete pref.categoryId
    return this.changed()
  }

  reorderCategories(ids: string[]): ShoppingList {
    if (ids.length !== this.categories.length || !this.categories.every((c) => ids.includes(c.id))) {
      throw invalid('Die Reihenfolge muss jede Kategorie genau einmal enthalten.')
    }
    for (const category of this.categories) category.position = ids.indexOf(category.id) + 1
    return this.changed()
  }

  createStore(name: string): ShoppingList {
    this.stores.push({ id: `shop-${this.nextId++}`, name: checkName(name, 60, 'Der Name') })
    return this.changed()
  }

  renameStore(id: string, name: string): ShoppingList {
    const store = this.stores.find((s) => s.id === id)
    if (!store) throw notFound()
    store.name = checkName(name, 60, 'Der Name')
    return this.changed()
  }

  deleteStore(id: string): ShoppingList {
    if (!this.stores.some((s) => s.id === id)) throw notFound()
    this.stores = this.stores.filter((s) => s.id !== id)
    for (const item of this.items) if (item.storeId === id) delete item.storeId
    for (const pref of this.prefs.values()) if (pref.storeId === id) delete pref.storeId
    return this.changed()
  }

  listAliases(): ShoppingAlias[] {
    return [...this.aliases]
      .map(([fromKey, alias]) => ({ fromKey, fromName: alias.fromName, toName: alias.toName }))
      .sort((a, b) => a.fromName.localeCompare(b.fromName, 'de'))
  }

  deleteAlias(fromKey: string): ShoppingAlias[] {
    if (!this.aliases.delete(fromKey)) throw notFound()
    this.changed()
    return this.listAliases()
  }

  listStaples(): Staple[] {
    return this.staples.map(({ id, text }) => ({ id, text }))
  }

  createStaple(text: string): Staple[] {
    const line = checkName(text, 200, 'Der Artikel')
    const key = shoppingKey(parseIngredient(line).name)
    if (!this.staples.some((staple) => staple.key === key)) this.staples.push({ id: `st-${this.nextId++}`, text: line, key })
    this.changed()
    return this.listStaples()
  }

  deleteStaple(id: string): Staple[] {
    if (!this.staples.some((staple) => staple.id === id)) throw notFound()
    this.staples = this.staples.filter((staple) => staple.id !== id)
    this.changed()
    return this.listStaples()
  }

  addStaples(ids: string[]): ShoppingList {
    for (const id of ids) {
      const staple = this.staples.find((candidate) => candidate.id === id)
      if (!staple) throw notFound()
      const parsed = parseIngredient(staple.text)
      this.addPart(parsed.name, { quantity: parsed.quantity, unit: parsed.unit, source: { kind: 'staple', text: staple.text } })
    }
    return this.changed()
  }

  /** Folgt Zusammenführungen und sucht den offenen Artikel oder die Kategorie für einen neuen. */
  private place(rawName: string) {
    let name = rawName.trim().split(/\s+/).join(' ')
    let key = shoppingKey(name)
    const alias = this.aliases.get(key)
    if (alias) {
      key = alias.toKey
      name = alias.toName
    }
    const item = this.items.find((candidate) => candidate.key === key && !candidate.checked)
    const pref = this.prefs.get(key)
    const suggested = `cat-${SUGGESTIONS[key] ?? 'sonstiges'}`
    const categoryId = pref?.categoryId ?? (this.categories.some((c) => c.id === suggested) ? suggested : 'cat-sonstiges')
    return { key, name, item, categoryId, storeId: pref?.storeId }
  }

  private addPart(rawName: string, part: Part) {
    if (!rawName.trim()) return
    const place = this.place(rawName)
    let item = place.item
    if (!item) {
      item = { id: `s-${this.nextId++}`, key: place.key, name: place.name, categoryId: place.categoryId, checked: false, parts: [] }
      if (place.storeId) item.storeId = place.storeId
      this.items.push(item)
    }
    item.parts.push({ ...part, source: { ...part.source, addedBy: MOCK_USER } })
  }

  private find(id: string): StoredItem {
    const item = this.items.find((candidate) => candidate.id === id)
    if (!item) throw notFound()
    return item
  }

  private changed(): ShoppingList {
    this.version++
    return this.snapshot()
  }

  private snapshot(): ShoppingList {
    const categories = [...this.categories].sort((a, b) => a.position - b.position)
    const order = (id: string) => categories.findIndex((c) => c.id === id)
    const items: ShoppingItem[] = this.items.map((item) => {
      const amounts = sumAmounts(item.parts)
      const sourceDisplay: ShoppingItem['sourceDisplay'] = {}
      for (const kind of new Set(item.parts.map((part) => part.source.kind))) {
        sourceDisplay[kind] = formatAmounts(sumAmounts(item.parts.filter((part) => part.source.kind === kind)))
      }
      const result: ShoppingItem = {
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        checked: item.checked,
        amounts,
        sources: item.parts.map((part) => {
          const amount = formatAmounts(sumAmounts([part]))
          return amount ? { ...part.source, amount } : { ...part.source }
        }),
        sourceDisplay,
      }
      if (item.storeId) result.storeId = item.storeId
      if (amounts.length > 0) result.display = formatAmounts(amounts)
      return result
    })
    items.sort(
      (a, b) =>
        order(a.categoryId) - order(b.categoryId) ||
        Number(a.checked) - Number(b.checked) ||
        a.name.localeCompare(b.name, 'de'),
    )
    return {
      version: this.version,
      categories: categories.map(({ id, name, slug }) => ({ id, name, removable: slug !== 'sonstiges' })),
      stores: structuredClone(this.stores),
      items,
    }
  }
}
