import type {
  CopyMode,
  EntryPatch,
  HouseholdSettings,
  IsoDate,
  IsoWeek,
  NewEntry,
  Recipe,
  RecipeInput,
  WeekPlan,
} from '../types'
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

  async createEntry(entry: NewEntry): Promise<WeekPlan[]> {
    const { weeks } = await request<{ weeks: WeekPlan[] }>('/api/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    })
    return weeks
  }

  async updateEntry(id: string, patch: EntryPatch): Promise<WeekPlan[]> {
    const { weeks } = await request<{ weeks: WeekPlan[] }>(`/api/entries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return weeks
  }

  async deleteEntry(id: string): Promise<WeekPlan[]> {
    const { weeks } = await request<{ weeks: WeekPlan[] }>(`/api/entries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    return weeks
  }

  copyWeek(from: IsoWeek, to: IsoWeek, mode: CopyMode): Promise<{ week: WeekPlan; skipped: number }> {
    return request(`/api/weeks/${encodeURIComponent(from)}/copy`, {
      method: 'POST',
      body: JSON.stringify({ to, mode }),
    })
  }

  async getRecipeHistory(id: string): Promise<IsoDate[]> {
    const { dates } = await request<{ dates: IsoDate[] }>(`/api/recipes/${encodeURIComponent(id)}/history`)
    return dates
  }

  getSettings(): Promise<HouseholdSettings> {
    return request('/api/settings')
  }

  updateSettings(patch: Partial<HouseholdSettings>): Promise<HouseholdSettings> {
    return request('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) })
  }
}
