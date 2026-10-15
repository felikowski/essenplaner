import { describe, expect, it } from 'vitest'
import type { Recipe } from '../types'
import { emptyRecipeFilters, findRecipesByIngredients, queryRecipes, recipeQueryFromParams, recipeQueryToParams } from './recipeQuery'

const recipes: Recipe[] = [
  {
    id: 'z', title: 'Zucchini-Curry', source: { kind: 'web', url: 'x' }, course: 'Hauptgericht', cuisine: 'Indisch',
    tags: ['vegetarisch', 'schnell'], rating: 4, totalMinutes: 30, lastPlannedOn: '2026-10-10', createdAt: '2026-10-01',
    ingredients: [{ text: '2 Zucchinischeiben', name: 'Zucchinischeiben' }, { text: '100 g Feta', name: 'Feta' }],
  },
  {
    id: 'a', title: 'Auflauf', source: { kind: 'pdf', pdfUrl: 'x' }, tags: ['Curry'], rating: 5, toTry: true,
    lastPlannedOn: '2026-09-01', createdAt: '2026-10-03', ingredients: [{ text: '1 EL Currypulver', name: 'Currypulver' }],
  },
  {
    id: 'n', title: 'Nudeln', source: { kind: 'manual' }, cuisine: 'Italienisch', createdAt: '2026-10-02',
    ingredients: [{ text: '1 Ei', name: 'Ei' }, { text: 'Salz', name: 'Salz' }],
  },
]

describe('Rezeptabfrage', () => {
  it('gewichtet Titel vor Tags, Küche und Zutaten', () => {
    expect(queryRecipes(recipes, { query: 'curry', sort: 'title', filters: emptyRecipeFilters() }).map((recipe) => recipe.id)).toEqual(['z', 'a'])
    expect(queryRecipes(recipes, { query: 'vegetarisch', sort: 'title', filters: emptyRecipeFilters() }).map((recipe) => recipe.id)).toEqual(['z'])
    expect(queryRecipes(recipes, { query: 'fehlt', sort: 'title', filters: emptyRecipeFilters() })).toEqual([])
  })

  it('filtert schnelle Hauptgerichte und Rezepte ohne Zeitangabe aus', () => {
    const filters = { ...emptyRecipeFilters(), course: 'Hauptgericht' as const, maxMinutes: 30 }
    expect(queryRecipes(recipes, { query: '', sort: 'title', filters }).map((recipe) => recipe.id)).toEqual(['z'])
  })

  it('sortiert nie geplante und danach am längsten nicht geplante Rezepte', () => {
    expect(queryRecipes(recipes, { query: '', sort: 'lastPlanned', filters: emptyRecipeFilters() }).map((recipe) => recipe.id)).toEqual(['n', 'a', 'z'])
  })

  it('liest Filter aus einem Link und schreibt sie verlustfrei zurück', () => {
    const params = new URLSearchParams('gang=Hauptgericht&tag=schnell&tag=vegetarisch&min=4&probieren=1&quelle=web&zeit=30&sort=rating&q=curry')
    const state = recipeQueryFromParams(params)
    expect(state).toMatchObject({ query: 'curry', sort: 'rating', filters: { course: 'Hauptgericht', tags: ['schnell', 'vegetarisch'], minRating: 4, toTry: true, source: 'web', maxMinutes: 30 } })
    expect(recipeQueryToParams(state).toString()).toBe(params.toString())
  })

  it('findet mehrere Zutaten, Teilwörter, Aliasse und kurze Wörter nur ganz', () => {
    const aliases = [{ fromKey: 'schafskäse', fromName: 'Schafskäse', toName: 'Feta' }]
    const results = findRecipesByIngredients(recipes, ['Zucchini', 'Schafskäse'], aliases)
    expect(results[0]).toMatchObject({ recipe: { id: 'z' }, matches: ['Zucchini', 'Schafskäse'], missing: [] })
    expect(findRecipesByIngredients(recipes, ['Ei'], []).map((result) => result.recipe.id)).toEqual(['n'])
    expect(findRecipesByIngredients(recipes, ['Eis'], [])).toEqual([])
  })

  it('liefert keine Ergebnisse, wenn keine Zutat passt', () => {
    expect(findRecipesByIngredients(recipes, ['Trüffel'], [])).toEqual([])
  })
})
