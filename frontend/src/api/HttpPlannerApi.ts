import type {
  CopyMode,
  EntryPatch,
  HouseholdSettings,
  IsoDate,
  IsoWeek,
  NewEntry,
  Recipe,
  RecipeInput,
  ShoppingAlias,
  ShoppingImportResult,
  ShoppingItemPatch,
  ShoppingList,
  Staple,
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

  async getShoppingList(knownVersion?: number): Promise<ShoppingList | null> {
    const headers: Record<string, string> = {}
    if (knownVersion !== undefined) headers['If-None-Match'] = `"v${knownVersion}"`
    const res = await fetch('/api/shopping/list', { headers })
    if (res.status === 304) return null
    if (!res.ok) throw new RequestError(`GET /api/shopping/list fehlgeschlagen: ${res.status}`, res.status)
    return res.json() as Promise<ShoppingList>
  }

  addShoppingItem(text: string): Promise<ShoppingList> {
    return send('POST', '/api/shopping/items', { text })
  }

  updateShoppingItem(id: string, patch: ShoppingItemPatch): Promise<ShoppingList> {
    return send('PATCH', `/api/shopping/items/${encodeURIComponent(id)}`, patch)
  }

  setShoppingItemChecked(id: string, checked: boolean): Promise<ShoppingList> {
    return send('PUT', `/api/shopping/items/${encodeURIComponent(id)}/checked`, { checked })
  }

  deleteShoppingItem(id: string): Promise<ShoppingList> {
    return send('DELETE', `/api/shopping/items/${encodeURIComponent(id)}`)
  }

  mergeShoppingItem(id: string, targetId: string): Promise<ShoppingList> {
    return send('POST', `/api/shopping/items/${encodeURIComponent(id)}/merge-into/${encodeURIComponent(targetId)}`)
  }

  importShoppingFromPlan(from: IsoDate, to: IsoDate): Promise<ShoppingImportResult> {
    return send('POST', '/api/shopping/import', { from, to })
  }

  clearCheckedShoppingItems(): Promise<ShoppingList> {
    return send('POST', '/api/shopping/clear-checked')
  }

  createShoppingCategory(name: string): Promise<ShoppingList> {
    return send('POST', '/api/shopping/categories', { name })
  }

  renameShoppingCategory(id: string, name: string): Promise<ShoppingList> {
    return send('PATCH', `/api/shopping/categories/${encodeURIComponent(id)}`, { name })
  }

  deleteShoppingCategory(id: string): Promise<ShoppingList> {
    return send('DELETE', `/api/shopping/categories/${encodeURIComponent(id)}`)
  }

  reorderShoppingCategories(ids: string[]): Promise<ShoppingList> {
    return send('PUT', '/api/shopping/categories/order', { ids })
  }

  createShoppingStore(name: string): Promise<ShoppingList> {
    return send('POST', '/api/shopping/stores', { name })
  }

  renameShoppingStore(id: string, name: string): Promise<ShoppingList> {
    return send('PATCH', `/api/shopping/stores/${encodeURIComponent(id)}`, { name })
  }

  deleteShoppingStore(id: string): Promise<ShoppingList> {
    return send('DELETE', `/api/shopping/stores/${encodeURIComponent(id)}`)
  }

  listShoppingAliases(): Promise<ShoppingAlias[]> {
    return request('/api/shopping/aliases')
  }

  deleteShoppingAlias(fromKey: string): Promise<ShoppingAlias[]> {
    return send('DELETE', `/api/shopping/aliases/${encodeURIComponent(fromKey)}`)
  }

  listStaples(): Promise<Staple[]> {
    return request('/api/shopping/staples')
  }

  createStaple(text: string): Promise<Staple[]> {
    return send('POST', '/api/shopping/staples', { text })
  }

  deleteStaple(id: string): Promise<Staple[]> {
    return send('DELETE', `/api/shopping/staples/${encodeURIComponent(id)}`)
  }

  addStaplesToList(ids: string[]): Promise<ShoppingList> {
    return send('POST', '/api/shopping/staples/add', { ids })
  }
}

function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return request(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
}
