import { describe, expect, it } from 'vitest'
import { daysOfWeek, isValidWeek } from './lib/isoWeek'
import { mockRecipes, mockWeeks } from './test/mockData'
import type { Recipe, WeekPlan } from './types'

// Prüft zur Laufzeit, dass public/mock/*.json exakt den Typen aus types.ts folgt.

const isString = (value: unknown): value is string => typeof value === 'string'
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString)
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function isRecipe(value: unknown): value is Recipe {
  if (!isObject(value)) return false
  if (!hasOnlyKeys(value, ['id', 'title', 'source', 'imageUrl', 'servings', 'ingredients', 'instructions']))
    return false
  const { id, title, source, imageUrl, servings, ingredients, instructions } = value
  if (!isString(id) || !isString(title) || !isObject(source)) return false
  const validSource =
    (source.kind === 'pdf' && isString(source.pdfUrl) && hasOnlyKeys(source, ['kind', 'pdfUrl'])) ||
    (source.kind === 'web' && isString(source.url) && hasOnlyKeys(source, ['kind', 'url']))
  return (
    validSource &&
    (imageUrl === undefined || isString(imageUrl)) &&
    (servings === undefined || isString(servings)) &&
    (ingredients === undefined || isStringArray(ingredients)) &&
    (instructions === undefined || isStringArray(instructions))
  )
}

function isWeekPlan(value: unknown): value is WeekPlan {
  if (!isObject(value) || !hasOnlyKeys(value, ['week', 'days'])) return false
  const { week, days } = value
  return (
    isString(week) &&
    isValidWeek(week) &&
    isObject(days) &&
    Object.values(days).every((recipeId) => recipeId === null || isString(recipeId))
  )
}

describe('Dummy-Daten', () => {
  it('recipes.json enthält gültige Rezepte mit eindeutigen IDs', () => {
    expect(Array.isArray(mockRecipes)).toBe(true)
    const recipes = mockRecipes as unknown[]
    for (const recipe of recipes) {
      expect(isRecipe(recipe), JSON.stringify(recipe)).toBe(true)
    }
    const ids = (recipes as Recipe[]).map((recipe) => recipe.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('recipes.json mischt PDF- und Web-Rezepte, manche ohne Bild oder Zutaten', () => {
    const recipes = mockRecipes as Recipe[]
    expect(recipes.some((recipe) => recipe.source.kind === 'pdf')).toBe(true)
    expect(recipes.some((recipe) => recipe.source.kind === 'web')).toBe(true)
    expect(recipes.some((recipe) => recipe.imageUrl === undefined)).toBe(true)
    expect(recipes.some((recipe) => recipe.ingredients === undefined)).toBe(true)
  })

  it('weeks.json enthält vollständige Wochen, die nur vorhandene Rezepte verwenden', () => {
    expect(Array.isArray(mockWeeks)).toBe(true)
    const recipeIds = new Set((mockRecipes as Recipe[]).map((recipe) => recipe.id))
    for (const plan of mockWeeks as unknown[]) {
      expect(isWeekPlan(plan), JSON.stringify(plan)).toBe(true)
      const { week, days } = plan as WeekPlan
      expect(Object.keys(days)).toEqual(daysOfWeek(week))
      for (const recipeId of Object.values(days)) {
        if (recipeId !== null) expect(recipeIds.has(recipeId), recipeId).toBe(true)
      }
    }
  })
})
