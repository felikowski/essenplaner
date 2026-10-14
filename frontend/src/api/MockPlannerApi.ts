import { parseIngredients } from '../lib/ingredient'
import { daysOfWeek, parseIsoDate, weekOf } from '../lib/isoWeek'
import type { IsoDate, IsoWeek, Recipe, RecipeInput, WeekPlan } from '../types'
import type { PlannerApi } from './PlannerApi'
import { RequestError, request } from './request'

export type JsonLoader = (file: string) => Promise<unknown>

const loadFromPublic: JsonLoader = (file) => request(`${import.meta.env.BASE_URL}mock/${file}`)

interface MockData {
  recipes: Recipe[]
  weeks: Map<IsoWeek, WeekPlan>
}

/**
 * Lädt Rezepte und Wochenpläne aus `public/mock/*.json` und hält Änderungen nur
 * im Speicher. Wird nur noch in Tests verwendet; die App nutzt HttpPlannerApi.
 */
export class MockPlannerApi implements PlannerApi {
  private readonly load: JsonLoader
  private data: Promise<MockData> | null = null

  constructor(load: JsonLoader = loadFromPublic) {
    this.load = load
  }

  async listRecipes(): Promise<Recipe[]> {
    const { recipes } = await this.getData()
    return structuredClone(recipes.filter(isAvailable))
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    const { recipes } = await this.getData()
    const recipe = recipes.find((candidate) => candidate.id === id)
    return recipe ? structuredClone(recipe) : null
  }

  async getWeek(week: IsoWeek): Promise<WeekPlan> {
    const { weeks } = await this.getData()
    return structuredClone(weeks.get(week) ?? emptyWeek(week))
  }

  async setDay(date: IsoDate, recipeId: string | null): Promise<WeekPlan> {
    const { recipes, weeks } = await this.getData()
    if (recipeId !== null && !recipes.some((recipe) => recipe.id === recipeId && isAvailable(recipe))) {
      throw new Error(`Unbekanntes Rezept: ${recipeId}`)
    }
    const week = weekOf(parseIsoDate(date))
    const plan = weeks.get(week) ?? emptyWeek(week)
    plan.days[date] = recipeId
    weeks.set(week, plan)
    return structuredClone(plan)
  }

  /**
   * Simuliert den Import: Adressen mit „keine-rezeptdaten“ scheitern wie beim Server mit 422,
   * alle anderen werden zu einem Rezept, dessen Titel aus dem letzten Pfadteil stammt.
   */
  async importRecipe(url: string): Promise<Recipe> {
    const { recipes } = await this.getData()
    if (url.includes('keine-rezeptdaten')) {
      throw new RequestError('POST /api/recipes/import fehlgeschlagen: 422', 422, 'Auf dieser Seite wurden keine Rezeptdaten gefunden.')
    }
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new RequestError('POST /api/recipes/import fehlgeschlagen: 400', 400, 'Bitte eine gültige Adresse einer öffentlichen Webseite angeben.')
    }
    const existing = recipes.find((recipe) => recipe.source.kind === 'web' && recipe.source.url === parsed.origin + parsed.pathname)
    if (existing) {
      existing.available = true
      existing.removable = true
      return structuredClone(existing)
    }
    const slug = parsed.pathname.split('/').filter(Boolean).pop() ?? 'rezept'
    const recipe: Recipe = {
      id: `w-${recipes.length + 1}`,
      title: slug.replace(/[-_]+/g, ' ').replace(/^./, (first) => first.toUpperCase()),
      source: { kind: 'web', url: parsed.origin + parsed.pathname },
      available: true,
      removable: true,
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

  async removeRecipe(id: string): Promise<void> {
    const { recipes } = await this.getData()
    const recipe = recipes.find((candidate) => candidate.id === id)
    if (!recipe) throw new RequestError(`DELETE /api/recipes/${id} fehlgeschlagen: 404`, 404)
    if (!recipe.removable) throw new RequestError(`DELETE /api/recipes/${id} fehlgeschlagen: 409`, 409)
    recipe.available = false
    recipe.removable = false
  }

  private getData(): Promise<MockData> {
    if (!this.data) {
      this.data = Promise.all([this.load('recipes.json'), this.load('weeks.json')]).then(
        ([recipes, weeks]) => ({
          recipes: (recipes as MockRecipe[]).map(fromMockRecipe),
          weeks: new Map((weeks as WeekPlan[]).map((plan) => [plan.week, completeWeek(plan)])),
        }),
      )
      // Nach einem Fehler beim nächsten Aufruf erneut laden.
      this.data.catch(() => {
        this.data = null
      })
    }
    return this.data
  }
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

function isAvailable(recipe: Recipe): boolean {
  return recipe.available !== false
}

function emptyWeek(week: IsoWeek): WeekPlan {
  return { week, days: Object.fromEntries(daysOfWeek(week).map((date) => [date, null])) }
}

function completeWeek(plan: WeekPlan): WeekPlan {
  const days = emptyWeek(plan.week).days
  for (const date of Object.keys(days)) {
    days[date] = plan.days[date] ?? null
  }
  return { week: plan.week, days }
}
