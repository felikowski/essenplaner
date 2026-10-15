import { RECIPE_COURSES, type Recipe, type RecipeCourse, type ShoppingAlias } from '../types'

export type RecipeSort = 'title' | 'rating' | 'lastPlanned' | 'created'

export interface RecipeFilters {
  course?: RecipeCourse
  tags: string[]
  minRating?: number
  toTry: boolean
  source?: Recipe['source']['kind']
  maxMinutes?: number
}

export interface RecipeQueryState {
  query: string
  sort: RecipeSort
  filters: RecipeFilters
}

export interface IngredientMatch {
  recipe: Recipe
  matches: string[]
  missing: string[]
}

const collator = new Intl.Collator('de', { sensitivity: 'base' })

export const emptyRecipeFilters = (): RecipeFilters => ({ tags: [], toTry: false })

export function queryRecipes(recipes: Recipe[], state: RecipeQueryState): Recipe[] {
  const needle = normalize(state.query)
  return recipes
    .filter((recipe) => matchesFilters(recipe, state.filters))
    .map((recipe) => ({ recipe, score: searchScore(recipe, needle) }))
    .filter(({ score }) => !needle || score !== null)
    .sort((a, b) => {
      if (needle && a.score !== b.score) return (a.score ?? 9) - (b.score ?? 9)
      return compareRecipes(a.recipe, b.recipe, state.sort)
    })
    .map(({ recipe }) => recipe)
}

export function matchesFilters(recipe: Recipe, filters: RecipeFilters): boolean {
  if (filters.course && recipe.course !== filters.course) return false
  if (filters.tags.some((tag) => !recipe.tags?.some((candidate) => normalize(candidate) === normalize(tag)))) return false
  if (filters.minRating !== undefined && (recipe.rating ?? 0) < filters.minRating) return false
  if (filters.toTry && !recipe.toTry) return false
  if (filters.source && recipe.source.kind !== filters.source) return false
  if (filters.maxMinutes !== undefined && (recipe.totalMinutes === undefined || recipe.totalMinutes > filters.maxMinutes)) return false
  return true
}

function searchScore(recipe: Recipe, needle: string): number | null {
  if (!needle) return 0
  if (normalize(recipe.title).includes(needle)) return 0
  if (recipe.tags?.some((tag) => normalize(tag).includes(needle))) return 1
  if (normalize(recipe.cuisine ?? '').includes(needle)) return 2
  if (recipe.ingredients?.some((ingredient) => normalize(ingredient.name).includes(needle))) return 3
  return null
}

function compareRecipes(a: Recipe, b: Recipe, sort: RecipeSort): number {
  switch (sort) {
    case 'rating':
      return (b.rating ?? 0) - (a.rating ?? 0) || collator.compare(a.title, b.title)
    case 'lastPlanned':
      if (!a.lastPlannedOn || !b.lastPlannedOn) {
        if (!a.lastPlannedOn && !b.lastPlannedOn) return collator.compare(a.title, b.title)
        return a.lastPlannedOn ? 1 : -1
      }
      return a.lastPlannedOn.localeCompare(b.lastPlannedOn) || collator.compare(a.title, b.title)
    case 'created':
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || collator.compare(a.title, b.title)
    default:
      return collator.compare(a.title, b.title)
  }
}

export function recipeQueryFromParams(params: URLSearchParams): RecipeQueryState {
  const course = params.get('gang')
  const minRating = numberInRange(params.get('min'), 1, 5)
  const maxMinutes = numberInRange(params.get('zeit'), 1, 1440)
  const source = params.get('quelle')
  const sort = params.get('sort')
  return {
    query: params.get('q') ?? '',
    sort: sort === 'rating' || sort === 'lastPlanned' || sort === 'created' ? sort : 'title',
    filters: {
      course: RECIPE_COURSES.includes(course as RecipeCourse) ? (course as RecipeCourse) : undefined,
      tags: params.getAll('tag').filter(Boolean),
      minRating,
      toTry: params.get('probieren') === '1',
      source: source === 'pdf' || source === 'web' || source === 'manual' ? source : undefined,
      maxMinutes,
    },
  }
}

export function recipeQueryToParams(state: RecipeQueryState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.filters.course) params.set('gang', state.filters.course)
  for (const tag of state.filters.tags) params.append('tag', tag)
  if (state.filters.minRating !== undefined) params.set('min', String(state.filters.minRating))
  if (state.filters.toTry) params.set('probieren', '1')
  if (state.filters.source) params.set('quelle', state.filters.source)
  if (state.filters.maxMinutes !== undefined) params.set('zeit', String(state.filters.maxMinutes))
  if (state.sort !== 'title') params.set('sort', state.sort)
  if (state.query.trim()) params.set('q', state.query.trim())
  return params
}

export function activeFilterCount(filters: RecipeFilters): number {
  return Number(Boolean(filters.course)) + filters.tags.length + Number(filters.minRating !== undefined) + Number(filters.toTry) + Number(Boolean(filters.source)) + Number(filters.maxMinutes !== undefined)
}

export function findRecipesByIngredients(recipes: Recipe[], inputs: string[], aliases: ShoppingAlias[]): IngredientMatch[] {
  const names = inputs.map((input) => input.trim()).filter(Boolean)
  const aliasMap = new Map(aliases.map((alias) => [shoppingKey(alias.fromKey), shoppingKey(alias.toName)]))
  const canonical = (value: string) => resolveAlias(shoppingKey(value), aliasMap)
  return recipes
    .map((recipe) => {
      const ingredientNames = (recipe.ingredients ?? []).map((ingredient) => canonical(ingredient.name))
      const matches = names.filter((input) => ingredientNames.some((name) => ingredientMatches(name, canonical(input))))
      return { recipe, matches, missing: names.filter((input) => !matches.includes(input)) }
    })
    .filter((result) => result.matches.length > 0)
    .sort((a, b) => b.matches.length - a.matches.length || collator.compare(a.recipe.title, b.recipe.title))
}

function ingredientMatches(name: string, needle: string): boolean {
  if (needle.length >= 4) return name.includes(needle)
  return name.split(/[^\p{L}\p{N}]+/u).includes(needle)
}

function shoppingKey(value: string): string {
  return normalize(value)
}

function resolveAlias(key: string, aliases: Map<string, string>): string {
  const seen = new Set<string>()
  while (aliases.has(key) && !seen.has(key)) {
    seen.add(key)
    key = aliases.get(key) ?? key
  }
  return key
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de')
}

function numberInRange(value: string | null, min: number, max: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const number = Number(value)
  return number >= min && number <= max ? number : undefined
}
