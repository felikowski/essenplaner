import { daysOfWeek, parseIsoDate, weekOf } from '../lib/isoWeek'
import type { IsoDate, IsoWeek, Recipe, WeekPlan } from '../types'
import type { PlannerApi } from './PlannerApi'
import { request } from './request'

export type JsonLoader = (file: string) => Promise<unknown>

const loadFromPublic: JsonLoader = (file) => request(`${import.meta.env.BASE_URL}mock/${file}`)

interface MockData {
  recipes: Recipe[]
  weeks: Map<IsoWeek, WeekPlan>
}

/**
 * Lädt Rezepte und Wochenpläne aus `public/mock/*.json` und hält Änderungen nur
 * im Speicher. Nach einem Neuladen der Seite gilt wieder der Stand der Dateien.
 */
export class MockPlannerApi implements PlannerApi {
  private readonly load: JsonLoader
  private data: Promise<MockData> | null = null

  constructor(load: JsonLoader = loadFromPublic) {
    this.load = load
  }

  async listRecipes(): Promise<Recipe[]> {
    const { recipes } = await this.getData()
    return structuredClone(recipes)
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
    if (recipeId !== null && !recipes.some((recipe) => recipe.id === recipeId)) {
      throw new Error(`Unbekanntes Rezept: ${recipeId}`)
    }
    const week = weekOf(parseIsoDate(date))
    const plan = weeks.get(week) ?? emptyWeek(week)
    plan.days[date] = recipeId
    weeks.set(week, plan)
    return structuredClone(plan)
  }

  private getData(): Promise<MockData> {
    if (!this.data) {
      this.data = Promise.all([this.load('recipes.json'), this.load('weeks.json')]).then(
        ([recipes, weeks]) => ({
          recipes: recipes as Recipe[],
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
