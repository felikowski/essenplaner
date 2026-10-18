import { parseIngredients } from '../lib/ingredient'
import { daysOfWeek, parseIsoDate, toIsoDate, weekOf } from '../lib/isoWeek'
import {
  type CurrentUser,
  type ApplyMenuResult,
  MEALS,
  type CopyMode,
  type EntryPatch,
  type HouseholdSettings,
  type IsoDate,
  type IsoWeek,
  type Menu,
  type MenuEntry,
  type MenuEntryPatch,
  type MenuInput,
  type MenuSummary,
  type NewEntry,
  type NewMenuEntry,
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
  menus: Menu[]
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
        if (leftover.leftoverOf?.id === entry.id && 'date' in leftover.leftoverOf) leftover.leftoverOf.date = date
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

  async listMenus(): Promise<MenuSummary[]> {
    const { menus } = await this.getData()
    return menus
      .map((menu) => ({
        id: menu.id,
        name: menu.name,
        description: menu.description,
        days: menu.days,
        recipeCount: Object.values(menu.entries).flat().filter((entry) => entry.kind === 'recipe').length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
  }

  async getMenu(id: string): Promise<Menu | null> {
    const { menus } = await this.getData()
    const menu = menus.find((candidate) => candidate.id === id)
    return menu ? structuredClone(menu) : null
  }

  async createMenu(input: MenuInput): Promise<Menu> {
    const data = await this.getData()
    const { name, description } = validateMenuInput(data.menus, input)
    const dates = input.from && input.to ? inclusiveDates(input.from, input.to) : []
    const entries: Record<number, MenuEntry[]> = {}
    let days = dates.length || input.days || 1
    if (days < 1 || days > 28) throw unprocessable('Ein Menü muss zwischen 1 und 28 Tage haben.')
    for (let day = 1; day <= days; day++) entries[day] = []

    if (dates.length) {
      const copies = new Map<string, MenuEntry>()
      for (const pass of [false, true]) {
        for (const [index, date] of dates.entries()) {
          for (const source of data.entries.filter((entry) => entry.date === date && (entry.kind === 'leftover') === pass)) {
            const copy: MenuEntry = {
              id: `me-${this.nextId++}`,
              day: index + 1,
              meal: source.meal,
              position: source.position,
              kind: source.kind,
            }
            if (source.recipeId) copy.recipeId = source.recipeId
            if (source.servings !== undefined) copy.servings = source.servings
            if (source.text) copy.text = source.text
            if (source.kind === 'leftover') {
              const original = copies.get(source.leftoverOf?.id ?? '')
              if (original) copy.leftoverOf = { id: original.id, day: original.day }
              else {
                copy.kind = 'note'
                copy.text = `Reste: ${data.recipes.find((recipe) => recipe.id === source.recipeId)?.title ?? 'Rezept'}`
                delete copy.recipeId
              }
            }
            entries[index + 1].push(copy)
            copies.set(source.id, copy)
          }
        }
      }
      const last = dates.findLastIndex((_date, index) => entries[index + 1].length > 0) + 1
      if (last === 0) throw unprocessable('Im gewählten Zeitraum gibt es keine Einträge.')
      days = last
      for (const key of Object.keys(entries).map(Number)) if (key > days) delete entries[key]
    }

    const menu: Menu = {
      id: `menu-${this.nextId++}`,
      name,
      days,
      createdAt: new Date().toISOString(),
      entries,
    }
    if (description) menu.description = description
    data.menus.push(menu)
    return structuredClone(menu)
  }

  async updateMenu(id: string, input: Pick<MenuInput, 'name' | 'description'>): Promise<Menu> {
    const data = await this.getData()
    const menu = findMenu(data, id)
    const { name, description } = validateMenuInput(data.menus, input, id)
    menu.name = name
    if (description) menu.description = description
    else delete menu.description
    return structuredClone(menu)
  }

  async deleteMenu(id: string): Promise<void> {
    const data = await this.getData()
    const index = data.menus.findIndex((menu) => menu.id === id)
    if (index < 0) throw new RequestError(`DELETE /api/menus/${id} fehlgeschlagen: 404`, 404)
    data.menus.splice(index, 1)
  }

  async createMenuEntry(menuId: string, input: NewMenuEntry): Promise<Menu> {
    const data = await this.getData()
    const menu = findMenu(data, menuId)
    if (input.day < 1 || input.day > menu.days) throw unprocessable('Ungültiger Tag, ungültige Mahlzeit oder ungültige Art.')
    const entry: MenuEntry = {
      id: `me-${this.nextId++}`,
      day: input.day,
      meal: input.meal,
      position: nextMenuPosition(menu, input.day, input.meal),
      kind: input.kind,
    }
    if (input.kind === 'recipe') {
      const recipe = data.recipes.find((candidate) => candidate.id === input.recipeId && isAvailable(candidate))
      if (!recipe) throw unprocessable('Dieses Rezept gibt es nicht oder es ist nicht mehr verfügbar.')
      entry.recipeId = recipe.id
      const servings = input.servings ?? recipe.servings
      if (servings !== undefined) entry.servings = servings
    } else if (input.kind === 'leftover') {
      const original = Object.values(menu.entries).flat().find((candidate) => candidate.id === input.leftoverOf)
      if (!original || original.kind !== 'recipe') throw unprocessable('Reste lassen sich nur zu einem Rezept dieses Menüs anlegen.')
      entry.recipeId = original.recipeId
      entry.leftoverOf = { id: original.id, day: original.day }
    } else entry.text = checkText(input.text)
    menu.entries[input.day].push(entry)
    return structuredClone(menu)
  }

  async updateMenuEntry(menuId: string, entryId: string, patch: MenuEntryPatch): Promise<Menu> {
    const data = await this.getData()
    const menu = findMenu(data, menuId)
    const entry = findMenuEntry(menu, entryId)
    const oldDay = entry.day
    const nextDay = patch.day ?? entry.day
    const nextMeal = patch.meal ?? entry.meal
    if (nextDay < 1 || nextDay > menu.days) throw unprocessable('Ungültiger Tag oder ungültige Mahlzeit.')
    if (nextDay !== entry.day || nextMeal !== entry.meal) {
      menu.entries[oldDay] = menu.entries[oldDay].filter((candidate) => candidate.id !== entry.id)
      entry.day = nextDay
      entry.meal = nextMeal
      entry.position = nextMenuPosition(menu, nextDay, nextMeal)
      menu.entries[nextDay].push(entry)
    }
    if ('servings' in patch) {
      if (entry.kind !== 'recipe') throw unprocessable('Portionen gibt es nur bei Rezepteinträgen.')
      if (patch.servings === null) delete entry.servings
      else if (patch.servings !== undefined) entry.servings = patch.servings
    }
    if (patch.text !== undefined) {
      if (entry.kind !== 'note' && entry.kind !== 'item') throw unprocessable('Text gibt es nur bei Notizen und Zutaten.')
      entry.text = checkText(patch.text)
    }
    return structuredClone(menu)
  }

  async deleteMenuEntry(menuId: string, entryId: string): Promise<Menu> {
    const data = await this.getData()
    const menu = findMenu(data, menuId)
    const entry = findMenuEntry(menu, entryId)
    for (const leftover of Object.values(menu.entries).flat()) {
      if (leftover.leftoverOf?.id !== entry.id) continue
      leftover.kind = 'note'
      leftover.text = `Reste: ${data.recipes.find((recipe) => recipe.id === leftover.recipeId)?.title ?? 'Rezept'}`
      delete leftover.recipeId
      delete leftover.leftoverOf
    }
    menu.entries[entry.day] = menu.entries[entry.day].filter((candidate) => candidate.id !== entry.id)
    return structuredClone(menu)
  }

  async appendMenuDay(id: string): Promise<Menu> {
    const data = await this.getData()
    const menu = findMenu(data, id)
    if (menu.days >= 28) throw unprocessable('Ein Menü muss zwischen 1 und 28 Tage haben.')
    menu.days++
    menu.entries[menu.days] = []
    return structuredClone(menu)
  }

  async removeMenuDay(id: string, day: number): Promise<Menu> {
    const data = await this.getData()
    const menu = findMenu(data, id)
    if (menu.days <= 1 || day < 1 || day > menu.days) throw unprocessable('Ein Menü muss zwischen 1 und 28 Tage haben.')
    const removed = menu.entries[day].map((entry) => entry.id)
    for (const entry of Object.values(menu.entries).flat()) {
      if (!entry.leftoverOf || !removed.includes(entry.leftoverOf.id)) continue
      entry.kind = 'note'
      entry.text = `Reste: ${data.recipes.find((recipe) => recipe.id === entry.recipeId)?.title ?? 'Rezept'}`
      delete entry.recipeId
      delete entry.leftoverOf
    }
    for (let current = day; current < menu.days; current++) {
      menu.entries[current] = menu.entries[current + 1]
      for (const entry of menu.entries[current]) entry.day = current
    }
    delete menu.entries[menu.days]
    menu.days--
    return structuredClone(menu)
  }

  async applyMenu(id: string, start: IsoDate): Promise<ApplyMenuResult> {
    const data = await this.getData()
    const menu = findMenu(data, id)
    const dates = Array.from({ length: menu.days }, (_, index) => toIsoDate(addDays(parseIsoDate(start), index)))
    const copies = new Map<string, StoredEntry>()
    const skipped: string[] = []
    for (const pass of [false, true]) {
      for (let day = 1; day <= menu.days; day++) {
        for (const source of menu.entries[day].filter((entry) => (entry.kind === 'leftover') === pass)) {
          const recipe = source.recipeId ? data.recipes.find((candidate) => candidate.id === source.recipeId) : undefined
          if (source.kind === 'recipe' && (!recipe || !isAvailable(recipe))) {
            if (recipe && !skipped.includes(recipe.title)) skipped.push(recipe.title)
            continue
          }
          const copy: StoredEntry = {
            id: `e-${this.nextId++}`,
            date: dates[day - 1],
            meal: source.meal,
            position: nextPosition(data.entries, dates[day - 1], source.meal),
            kind: source.kind,
          }
          if (source.kind === 'leftover') {
            const original = copies.get(source.leftoverOf?.id ?? '')
            if (!original) {
              if (recipe && !skipped.includes(recipe.title)) skipped.push(recipe.title)
              continue
            }
            copy.recipeId = source.recipeId
            copy.leftoverOf = { id: original.id, date: original.date }
          } else {
            if (source.recipeId) copy.recipeId = source.recipeId
            if (source.servings !== undefined) copy.servings = source.servings
            if (source.text) copy.text = source.text
          }
          data.entries.push(copy)
          copies.set(source.id, copy)
        }
      }
    }
    return { weeks: weeksOf(data, dates), skipped }
  }

  async getRecipeHistory(id: string): Promise<IsoDate[]> {
    const { entries } = await this.getData()
    return entries
      .filter((entry) => entry.kind === 'recipe' && entry.recipeId === id)
      .map((entry) => entry.date)
      .sort()
      .reverse()
  }

  async getMe(): Promise<CurrentUser> {
    return { name: 'Familie' }
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
          menus: [],
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

function findMenu(data: MockData, id: string): Menu {
  const menu = data.menus.find((candidate) => candidate.id === id)
  if (!menu) throw new RequestError(`Menü ${id} fehlgeschlagen: 404`, 404)
  return menu
}

function findMenuEntry(menu: Menu, id: string): MenuEntry {
  const entry = Object.values(menu.entries).flat().find((candidate) => candidate.id === id)
  if (!entry) throw new RequestError(`Menüeintrag ${id} fehlgeschlagen: 404`, 404)
  return entry
}

function nextMenuPosition(menu: Menu, day: number, meal: string): number {
  return Math.max(0, ...menu.entries[day].filter((entry) => entry.meal === meal).map((entry) => entry.position)) + 1
}

function validateMenuInput(menus: Menu[], input: Pick<MenuInput, 'name' | 'description'>, ownId?: string) {
  const name = input.name.trim()
  const description = input.description?.trim() ?? ''
  if (!name || [...name].length > 100) throw unprocessable('Der Name muss 1 bis 100 Zeichen lang sein.')
  if ([...description].length > 500) throw unprocessable('Die Beschreibung darf höchstens 500 Zeichen lang sein.')
  const key = name.replace(/\s+/g, ' ').toLocaleLowerCase('de')
  if (menus.some((menu) => menu.id !== ownId && menu.name.replace(/\s+/g, ' ').toLocaleLowerCase('de') === key)) {
    throw unprocessable('Ein Menü mit diesem Namen gibt es schon.')
  }
  return { name, description }
}

function inclusiveDates(from: IsoDate, to: IsoDate): IsoDate[] {
  const start = parseIsoDate(from)
  const end = parseIsoDate(to)
  const dates: IsoDate[] = []
  for (let date = start; date <= end && dates.length <= 28; date = addDays(date, 1)) dates.push(toIsoDate(date))
  if (!dates.length || dates.length > 28) throw unprocessable('Ein Menü muss zwischen 1 und 28 Tage haben.')
  return dates
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
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
