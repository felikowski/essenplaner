import type { IsoDate, IsoWeek, Recipe, RecipeInput, WeekPlan } from '../types'
import type { PlannerApi } from './PlannerApi'
import { RequestError, request } from './request'

/** Spricht mit der Go-API unter /api (im Dev-Modus per Vite-Proxy). */
export class HttpPlannerApi implements PlannerApi {
  listRecipes(): Promise<Recipe[]> {
    return request('/api/recipes')
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    try {
      return await request<Recipe>(`/api/recipes/${encodeURIComponent(id)}`)
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) return null
      throw error
    }
  }

  getWeek(week: IsoWeek): Promise<WeekPlan> {
    return request(`/api/weeks/${encodeURIComponent(week)}`)
  }

  importRecipe(url: string): Promise<Recipe> {
    return request('/api/recipes/import', { method: 'POST', body: JSON.stringify({ url }) })
  }

  createRecipe(input: RecipeInput): Promise<Recipe> {
    return request('/api/recipes', { method: 'POST', body: JSON.stringify(input) })
  }

  updateRecipe(id: string, input: RecipeInput): Promise<Recipe> {
    return request(`/api/recipes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
  }

  removeRecipe(id: string): Promise<void> {
    return request(`/api/recipes/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  setDay(date: IsoDate, recipeId: string | null): Promise<WeekPlan> {
    return request(`/api/days/${encodeURIComponent(date)}`, {
      method: 'PUT',
      body: JSON.stringify({ recipeId }),
    })
  }
}
