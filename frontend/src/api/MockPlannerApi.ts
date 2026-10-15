import { parseIngredients } from '../lib/ingredient'
import { daysOfWeek, parseIsoDate, weekOf } from '../lib/isoWeek'
import {
  MEALS,
  type CopyMode,
  type EntryPatch,
  type HouseholdSettings,
  type IsoDate,
  type IsoWeek,
  type NewEntry,
  type PlanEntry,
  type Recipe,
  type RecipeInput,
  type RecipeOrganizationPatch,
  type ShoppingAlias,
  type ShoppingImportResult,
  type ShoppingItemPatch,
  type ShoppingList,
  type Staple,
  type TagSummary,
  type WeekPlan,
} from '../types'
import { MockShopping } from './mockShopping'
import type { PlannerApi } from './PlannerApi'
import { RequestError, request } from './request'

export type JsonLoader = (file: string) => Promise<unknown>

const loadFromPublic: JsonLoader = (file) => request(`${import.meta.env.BASE_URL}mock/${file}`)

type StoredEntry = PlanEntry & { date: IsoDate }

interface MockData {
  recipes: Recipe[]
  entries: StoredEntry[]
  settings: HouseholdSettings
}

/** Format von public/mock/weeks.json: je Tag die ID des Abendessens oder null. */
interface MockWeek {
  week: IsoWeek
  days: Record<IsoDate, string | null>
}

/**
 * Lädt Rezepte und Wochenpläne aus `public/mock/*.json` und hält Änderungen nur im Speicher.
 * Verhält sich wie das Backend; wird nur in Tests verwendet, die App nutzt HttpPlannerApi.
 */
export class MockPlannerApi implements PlannerApi {
  private readonly load: JsonLoader
  private data: Promise<MockData> | null = null
  private nextId = 1
  private readonly shopping = new MockShopping(() => this.getData())

  constructor(load: JsonLoader = loadFromPublic) {
    this.load = load
  }

  async listRecipes(): Promise<Recipe[]> {
    const { recipes, entries } = await this.getData()
    return recipes.filter(isAvailable).map((recipe) => withHistory(recipe, entries))
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    const { recipes, entries } = await this.getData()
    const recipe = recipes.find((candidate) => candidate.id === id)
    return recipe ? withHistory(recipe, entries) : null
  }

  async getWeek(week: IsoWeek): Promise<WeekPlan> {
    const data = await this.getData()
    return weekPlan(data, week)
  }

  async createEntry(input: NewEntry): Promise<WeekPlan[]> {
    const data = await this.getData()
    const entry: StoredEntry = {
      id: `e-${this.nextId++}`,
      date: input.date,
      meal: input.meal,
      kind: input.kind,
      position: nextPosition(data.entries, input.date, input.meal),
    }
    if (input.kind === 'recipe') {
      const recipe = data.recipes.find((candidate) => candidate.id === input.recipeId && isAvailable(candidate))
      if (!recipe) throw unprocessable('Dieses Rezept gibt es nicht oder es ist nicht mehr verfügbar.')
      entry.recipeId = recipe.id
      const servings = input.servings ?? recipe.servings
      if (servings !== undefined) entry.servings = servings
    } else if (input.kind === 'leftover') {
      const original = data.entries.find((candidate) => candidate.id === input.leftoverOf)
      if (!original || original.kind !== 'recipe') {
        throw unprocessable('Reste lassen sich nur zu einem eingeplanten Rezept anlegen.')
      }
      entry.recipeId = original.recipeId
      entry.leftoverOf = { id: original.id, date: original.date }
    } else {
      entry.text = checkText(input.text)
    }
    data.entries.push(entry)
    return weeksOf(data, [entry.date])
  }

  async updateEntry(id: string, patch: EntryPatch): Promise<WeekPlan[]> {
    const data = await this.getData()
    const entry = findEntry(data, id)
    const before = entry.date
    if (patch.servings !== undefined && entry.kind !== 'recipe') {
      throw unprocessable('Portionen gibt es nur bei Rezepteinträgen.')
    }
    if (patch.text !== undefined && entry.kind !== 'note' && entry.kind !== 'item') {
      throw unprocessable('Text gibt es nur bei Notizen und Zutaten.')
    }
    const date = patch.date ?? entry.date
    const meal = patch.meal ?? entry.meal
    if (date !== entry.date || meal !== entry.meal) {
      entry.position = nextPosition(data.entries, date, meal)
      entry.date = date
      entry.meal = meal
      for (const leftover of data.entries) {
        if (leftover.leftoverOf?.id === entry.id) leftover.leftoverOf.date = date
      }
    }
    if (patch.servings !== undefined) {
      if (patch.servings === null) delete entry.servings
      else entry.servings = patch.servings
    }
    if (patch.text !== undefined) entry.text = checkText(patch.text)
    return weeksOf(data, [before, entry.date])
  }

  async deleteEntry(id: string): Promise<WeekPlan[]> {
    const data = await this.getData()
    const entry = findEntry(data, id)
    const dates = deleteEntries(data, [id])
    return weeksOf(data, [...dates, entry.date])
  }

  async copyWeek(from: IsoWeek, to: IsoWeek, mode: CopyMode): Promise<{ week: WeekPlan; skipped: number }> {
    const data = await this.getData()
    if (from === to) throw unprocessable('Quell- und Zielwoche müssen verschieden sein.')
    const fromDays = daysOfWeek(from)
    const toDays = daysOfWeek(to)
    const source = data.entries
      .filter((entry) => fromDays.includes(entry.date))
      .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || a.position - b.position)
    if (mode === 'replace') {
      deleteEntries(
        data,
        data.entries.filter((entry) => toDays.includes(entry.date)).map((entry) => entry.id),
      )
    }
    const copies = new Map<string, StoredEntry>()
    let skipped = 0
    for (const leftovers of [false, true]) {
      for (const entry of source.filter((candidate) => (candidate.kind === 'leftover') === leftovers)) {
        const copy: StoredEntry = { ...structuredClone(entry), id: `e-${this.nextId++}` }
        copy.date = toDays[fromDays.indexOf(entry.date)]
        if (entry.kind === 'recipe' && !data.recipes.some((r) => r.id === entry.recipeId && isAvailable(r))) {
          skipped++
          continue
        }
        if (entry.kind === 'leftover') {
          const original = entry.leftoverOf && copies.get(entry.leftoverOf.id)
          if (!original) {
            skipped++
            continue
          }
          copy.leftoverOf = { id: original.id, date: original.date }
        }
        copy.position = nextPosition(data.entries, copy.date, copy.meal)
        data.entries.push(copy)
        copies.set(entry.id, copy)
      }
    }
    return { week: weekPlan(data, to), skipped }
  }

  async getRecipeHistory(id: string): Promise<IsoDate[]> {
    const { entries } = await this.getData()
    return entries
      .filter((entry) => entry.kind === 'recipe' && entry.recipeId === id)
      .map((entry) => entry.date)
      .sort()
      .reverse()
  }

  async getSettings(): Promise<HouseholdSettings> {
    const { settings } = await this.getData()
    return structuredClone(settings)
  }

  async updateSettings(patch: Partial<HouseholdSettings>): Promise<HouseholdSettings> {
    const data = await this.getData()
    if (patch.visibleMeals !== undefined) {
      if (patch.visibleMeals.length === 0) throw unprocessable('Mindestens eine Mahlzeit muss sichtbar bleiben.')
      data.settings.visibleMeals = MEALS.filter((meal) => patch.visibleMeals?.includes(meal))
    }
    return structuredClone(data.settings)
  }

  /**
   * Simuliert den Import: Adressen mit „keine-rezeptdaten“ scheitern wie beim Server mit 422,
   * alle anderen werden zu einem Rezept, dessen Titel aus dem letzten Pfadteil stammt.
   */
  async importRecipe(url: string): Promise<Recipe> {
    const { recipes } = await this.getData()
    if (url.includes('keine-rezeptdaten')) {
      throw new RequestError(
        'POST /api/recipes/import fehlgeschlagen: 422',
        422,
        'Auf dieser Seite wurden keine Rezeptdaten gefunden.',
      )
    }
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new RequestError(
        'POST /api/recipes/import fehlgeschlagen: 400',
        400,
        'Bitte eine gültige Adresse einer öffentlichen Webseite angeben.',
      )
    }
    const address = parsed.origin + parsed.pathname
    const existing = recipes.find((recipe) => recipe.source.kind === 'web' && recipe.source.url === address)
    if (existing) {
      existing.available = true
      existing.removable = true
      return structuredClone(existing)
    }
    const slug = parsed.pathname.split('/').filter(Boolean).pop() ?? 'rezept'
    const recipe: Recipe = {
      id: `w-${recipes.length + 1}`,
      title: slug.replace(/[-_]+/g, ' ').replace(/^./, (first) => first.toUpperCase()),
      source: { kind: 'web', url: address },
      available: true,
      removable: true,
      createdAt: new Date().toISOString(),
    }
    recipes.push(recipe)
    return structuredClone(recipe)
  }

  async createRecipe(input: RecipeInput): Promise<Recipe> {
    const { recipes } = await this.getData()
    validate(input)
    const recipe: Recipe = {
      id: `m-${recipes.length + 1}`,
      title: input.title.trim(),
      source: { kind: 'manual' },
      available: true,
      removable: true,
      titleEditable: true,
      createdAt: new Date().toISOString(),
    }
    applyInput(recipe, input)
    recipes.push(recipe)
    return structuredClone(recipe)
  }

  async updateRecipe(id: string, input: RecipeInput): Promise<Recipe> {
    const { recipes } = await this.getData()
    const recipe = recipes.find((candidate) => candidate.id === id)
    if (!recipe) throw new RequestError(`PUT /api/recipes/${id} fehlgeschlagen: 404`, 404)
    validate(input)
    if (input.title.trim() !== recipe.title) {
      if (!recipe.titleEditable) {
        throw new RequestError('PUT fehlgeschlagen: 422', 422, 'Der Titel lässt sich nur bei eigenen Rezepten ändern.', 'title')
      }
      recipe.title = input.title.trim()
    }
    applyInput(recipe, input)
    return structuredClone(recipe)
  }

  async updateRecipeOrganization(id: string, patch: RecipeOrganizationPatch): Promise<Recipe> {
    const data = await this.getData()
    const recipe = data.recipes.find((candidate) => candidate.id === id)
    if (!recipe) throw new RequestError(`PATCH /api/recipes/${id}/organization fehlgeschlagen: 404`, 404)
    applyOrganization(recipe, patch)
    return withHistory(recipe, data.entries)
  }

  async removeRecipe(id: string): Promise<void> {
    const { recipes } = await this.getData()
    const recipe = recipes.find((candidate) => candidate.id === id)
    if (!recipe) throw new RequestError(`DELETE /api/recipes/${id} fehlgeschlagen: 404`, 404)
    if (!recipe.removable) throw new RequestError(`DELETE /api/recipes/${id} fehlgeschlagen: 409`, 409)
    recipe.available = false
    recipe.removable = false
  }

  async listTags(): Promise<TagSummary[]> {
    const { recipes } = await this.getData()
    return summarizeTags(recipes)
  }

  async renameTag(name: string, newName: string): Promise<TagSummary[]> {
    const { recipes } = await this.getData()
    const fromKey = organizationKey(name)
    const target = newName.trim().replace(/\s+/g, ' ')
    if (!target || [...target].length > 30) throw organizationError('Der Tag darf höchstens 30 Zeichen lang sein.', 'name')
    if (!recipes.some((recipe) => recipe.tags?.some((tag) => organizationKey(tag) === fromKey))) {
      throw new RequestError('Tag nicht gefunden: 404', 404)
    }
    const targetKey = organizationKey(target)
    const existing = recipes.flatMap((recipe) => recipe.tags ?? []).find((tag) => organizationKey(tag) === targetKey)
    const spelling = targetKey === fromKey ? target : (existing ?? target)
    for (const recipe of recipes) {
      if (!recipe.tags?.some((tag) => organizationKey(tag) === fromKey)) continue
      recipe.tags = uniqueTags(recipe.tags.map((tag) => (organizationKey(tag) === fromKey ? spelling : tag)))
    }
    return summarizeTags(recipes)
  }

  async deleteTag(name: string): Promise<TagSummary[]> {
    const { recipes } = await this.getData()
    const key = organizationKey(name)
    let found = false
    for (const recipe of recipes) {
      const next = recipe.tags?.filter((tag) => organizationKey(tag) !== key)
      if (next && next.length !== recipe.tags?.length) found = true
      if (next?.length) recipe.tags = next
      else delete recipe.tags
    }
    if (!found) throw new RequestError('Tag nicht gefunden: 404', 404)
    return summarizeTags(recipes)
  }

  async getShoppingList(knownVersion?: number): Promise<ShoppingList | null> {
    return this.shopping.list(knownVersion)
  }

  async addShoppingItem(text: string): Promise<ShoppingList> {
    return this.shopping.addItem(text)
  }

  async updateShoppingItem(id: string, patch: ShoppingItemPatch): Promise<ShoppingList> {
    return this.shopping.updateItem(id, patch)
  }

  async setShoppingItemChecked(id: string, checked: boolean): Promise<ShoppingList> {
    return this.shopping.setChecked(id, checked)
  }

  async deleteShoppingItem(id: string): Promise<ShoppingList> {
    return this.shopping.deleteItem(id)
  }

  async mergeShoppingItem(id: string, targetId: string): Promise<ShoppingList> {
    return this.shopping.merge(id, targetId)
  }

  importShoppingFromPlan(from: IsoDate, to: IsoDate): Promise<ShoppingImportResult> {
    return this.shopping.importFromPlan(from, to)
  }

  async clearCheckedShoppingItems(): Promise<ShoppingList> {
    return this.shopping.clearChecked()
  }

  async createShoppingCategory(name: string): Promise<ShoppingList> {
    return this.shopping.createCategory(name)
  }

  async renameShoppingCategory(id: string, name: string): Promise<ShoppingList> {
    return this.shopping.renameCategory(id, name)
  }

  async deleteShoppingCategory(id: string): Promise<ShoppingList> {
    return this.shopping.deleteCategory(id)
  }

  async reorderShoppingCategories(ids: string[]): Promise<ShoppingList> {
    return this.shopping.reorderCategories(ids)
  }

  async createShoppingStore(name: string): Promise<ShoppingList> {
    return this.shopping.createStore(name)
  }

  async renameShoppingStore(id: string, name: string): Promise<ShoppingList> {
    return this.shopping.renameStore(id, name)
  }

  async deleteShoppingStore(id: string): Promise<ShoppingList> {
    return this.shopping.deleteStore(id)
  }

  async listShoppingAliases(): Promise<ShoppingAlias[]> {
    return this.shopping.listAliases()
  }

  async deleteShoppingAlias(fromKey: string): Promise<ShoppingAlias[]> {
    return this.shopping.deleteAlias(fromKey)
  }

  async listStaples(): Promise<Staple[]> {
    return this.shopping.listStaples()
  }

  async createStaple(text: string): Promise<Staple[]> {
    return this.shopping.createStaple(text)
  }

  async deleteStaple(id: string): Promise<Staple[]> {
    return this.shopping.deleteStaple(id)
  }

  async addStaplesToList(ids: string[]): Promise<ShoppingList> {
    return this.shopping.addStaples(ids)
  }

  private getData(): Promise<MockData> {
    if (!this.data) {
      this.data = Promise.all([this.load('recipes.json'), this.load('weeks.json')]).then(([recipes, weeks]) => {
        const loaded = (recipes as MockRecipe[]).map(fromMockRecipe)
        return {
          recipes: loaded,
          entries: (weeks as MockWeek[]).flatMap((week) => entriesFromMockWeek(week, loaded, () => this.nextId++)),
          settings: { visibleMeals: ['dinner'] },
        }
      })
      // Nach einem Fehler beim nächsten Aufruf erneut laden.
      this.data.catch(() => {
        this.data = null
      })
    }
    return this.data
  }
}

function entriesFromMockWeek(week: MockWeek, recipes: Recipe[], nextId: () => number): StoredEntry[] {
  return Object.entries(week.days).flatMap(([date, recipeId]) => {
    if (!recipeId) return []
    const entry: StoredEntry = { id: `e-${nextId()}`, date, meal: 'dinner', position: 1, kind: 'recipe', recipeId }
    const servings = recipes.find((recipe) => recipe.id === recipeId)?.servings
    if (servings !== undefined) entry.servings = servings
    return [entry]
  })
}

function weekPlan(data: MockData, week: IsoWeek): WeekPlan {
  const days: Record<IsoDate, PlanEntry[]> = {}
  for (const date of daysOfWeek(week)) {
    days[date] = data.entries
      .filter((entry) => entry.date === date)
      .sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || a.position - b.position)
      .map(({ date: _date, ...entry }) => structuredClone(entry))
  }
  return { week, days }
}

function weeksOf(data: MockData, dates: IsoDate[]): WeekPlan[] {
  const weeks = [...new Set(dates.map((date) => weekOf(parseIsoDate(date))))]
  return weeks.map((week) => weekPlan(data, week))
}

function nextPosition(entries: StoredEntry[], date: IsoDate, meal: string): number {
  return Math.max(0, ...entries.filter((e) => e.date === date && e.meal === meal).map((e) => e.position)) + 1
}

function findEntry(data: MockData, id: string): StoredEntry {
  const entry = data.entries.find((candidate) => candidate.id === id)
  if (!entry) throw new RequestError(`Eintrag ${id} fehlgeschlagen: 404`, 404)
  return entry
}

/** Löscht Einträge; Reste, die auf sie verweisen, werden zu Notizen. Liefert die Daten der umgewandelten Reste. */
function deleteEntries(data: MockData, ids: string[]): IsoDate[] {
  const dates: IsoDate[] = []
  for (const entry of data.entries) {
    if (entry.kind === 'leftover' && entry.leftoverOf && ids.includes(entry.leftoverOf.id) && !ids.includes(entry.id)) {
      const title = data.recipes.find((recipe) => recipe.id === entry.recipeId)?.title ?? 'Rezept'
      entry.kind = 'note'
      entry.text = `Reste: ${title}`
      delete entry.recipeId
      delete entry.leftoverOf
      dates.push(entry.date)
    }
  }
  data.entries = data.entries.filter((entry) => !ids.includes(entry.id))
  return dates
}

function checkText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 200) throw unprocessable('Der Text muss 1 bis 200 Zeichen lang sein.')
  return trimmed
}

function unprocessable(message: string): RequestError {
  return new RequestError(`fehlgeschlagen: 422`, 422, message)
}

/** Format von public/mock/recipes.json: Zutaten als Zeilen, wie man sie eintippt. */
type MockRecipe = Omit<Recipe, 'ingredients'> & { ingredients?: string[] }

function fromMockRecipe({ ingredients, ...recipe }: MockRecipe): Recipe {
  return ingredients ? { ...recipe, ingredients: toIngredients(ingredients) } : recipe
}

function toIngredients(lines: string[]) {
  return parseIngredients(lines).map(({ quantityMin: _quantityMin, ...ingredient }) => ingredient)
}

/** Prüft wie das Backend die wichtigsten Regeln, damit Tests Fehler am Formular sehen können. */
function validate(input: RecipeInput) {
  if (!input.title.trim()) {
    throw new RequestError('fehlgeschlagen: 422', 422, 'Bitte einen Titel eingeben.', 'title')
  }
  if (input.servings !== null && (!Number.isInteger(input.servings) || input.servings < 1 || input.servings > 99)) {
    throw new RequestError('fehlgeschlagen: 422', 422, 'Portionen müssen eine ganze Zahl von 1 bis 99 sein.', 'servings')
  }
}

function applyInput(recipe: Recipe, input: RecipeInput) {
  const ingredients = toIngredients(input.ingredients)
  const instructions = input.instructions.map((step) => step.trim()).filter(Boolean)
  if (input.servings === null) delete recipe.servings
  else recipe.servings = input.servings
  if (ingredients.length > 0) recipe.ingredients = ingredients
  else delete recipe.ingredients
  if (instructions.length > 0) recipe.instructions = instructions
  else delete recipe.instructions
}

function applyOrganization(recipe: Recipe, patch: RecipeOrganizationPatch) {
  const next = structuredClone(recipe)
  if (patch.course !== undefined) {
    if (patch.course === null) delete next.course
    else next.course = patch.course
  }
  if (patch.cuisine !== undefined) {
    const cuisine = patch.cuisine?.trim().replace(/^./u, (letter) => letter.toLocaleUpperCase('de'))
    if (cuisine) next.cuisine = cuisine
    else delete next.cuisine
  }
  if (patch.tags !== undefined) {
    const tags = uniqueTags(patch.tags)
    if (tags.length) next.tags = tags
    else delete next.tags
  }
  if (patch.rating !== undefined) {
    if (patch.rating === null) delete next.rating
    else next.rating = patch.rating
  }
  if (patch.toTry !== undefined) next.toTry = patch.toTry
  if (patch.notes !== undefined) {
    const notes = patch.notes?.trim()
    if (notes) next.notes = notes
    else delete next.notes
  }
  if (patch.totalMinutes !== undefined) {
    if (patch.totalMinutes === null) delete next.totalMinutes
    else next.totalMinutes = patch.totalMinutes
  }
  validateOrganization(next)
  Object.assign(recipe, next)
  for (const key of ['course', 'cuisine', 'tags', 'rating', 'notes', 'totalMinutes'] as const) {
    if (!(key in next)) delete recipe[key]
  }
}

function validateOrganization(recipe: Recipe) {
  if (recipe.cuisine && [...recipe.cuisine].length > 50) {
    throw organizationError('Die Küche darf höchstens 50 Zeichen lang sein.', 'cuisine')
  }
  if (recipe.tags && (recipe.tags.length > 20 || recipe.tags.some((tag) => [...tag].length > 30))) {
    throw organizationError('Es sind höchstens 20 Tags mit je 30 Zeichen möglich.', 'tags')
  }
  if (recipe.rating !== undefined && (!Number.isInteger(recipe.rating) || recipe.rating < 1 || recipe.rating > 5)) {
    throw organizationError('Die Bewertung muss zwischen 1 und 5 liegen.', 'rating')
  }
  if (recipe.notes && [...recipe.notes].length > 2000) {
    throw organizationError('Notizen dürfen höchstens 2000 Zeichen lang sein.', 'notes')
  }
  if (recipe.totalMinutes !== undefined && (!Number.isInteger(recipe.totalMinutes) || recipe.totalMinutes < 1 || recipe.totalMinutes > 1440)) {
    throw organizationError('Die Zeit muss zwischen 1 und 1440 Minuten liegen.', 'totalMinutes')
  }
}

function organizationError(message: string, field: string): RequestError {
  return new RequestError('fehlgeschlagen: 422', 422, message, field)
}

function organizationKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de')
}

function uniqueTags(tags: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of tags) {
    const tag = value.trim().replace(/\s+/g, ' ')
    const key = organizationKey(tag)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

function summarizeTags(recipes: Recipe[]): TagSummary[] {
  const tags = new Map<string, TagSummary>()
  for (const recipe of recipes) {
    for (const tag of recipe.tags ?? []) {
      const key = organizationKey(tag)
      const summary = tags.get(key)
      if (summary) summary.count++
      else tags.set(key, { name: tag, count: 1 })
    }
  }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
}

function withHistory(recipe: Recipe, entries: StoredEntry[]): Recipe {
  const copy = structuredClone(recipe)
  const dates = entries.filter((entry) => entry.kind === 'recipe' && entry.recipeId === recipe.id).map((entry) => entry.date)
  if (dates.length) copy.lastPlannedOn = dates.sort().at(-1)
  else delete copy.lastPlannedOn
  return copy
}

function isAvailable(recipe: Recipe): boolean {
  return recipe.available !== false
}
