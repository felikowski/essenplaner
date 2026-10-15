import { describe, expect, it } from 'vitest'
import type { PlanEntry, Recipe } from '../types'
import { recipeLinkTarget } from './entries'

const soup = { id: 'linsensuppe', title: 'Linsensuppe', source: { kind: 'manual' }, servings: 6 } satisfies Recipe
const original: PlanEntry = { id: 'e1', meal: 'dinner', position: 0, kind: 'recipe', recipeId: 'linsensuppe', servings: 8 }
const leftover: PlanEntry = {
  id: 'e2',
  meal: 'lunch',
  position: 0,
  kind: 'leftover',
  recipeId: 'linsensuppe',
  leftoverOf: { id: 'e1', date: '2026-10-01' },
}

describe('recipeLinkTarget', () => {
  it.each([
    { name: 'abweichende Portionen', entry: original, week: [original], expected: '/rezepte/linsensuppe?portionen=8' },
    { name: 'gleiche Portionen', entry: { ...original, servings: 6 }, week: [], expected: '/rezepte/linsensuppe' },
    { name: 'ohne Portionen', entry: { ...original, servings: undefined }, week: [], expected: '/rezepte/linsensuppe' },
    { name: 'Reste mit Original in der Woche', entry: leftover, week: [original, leftover], expected: '/rezepte/linsensuppe?portionen=8' },
    { name: 'Reste ohne Original in der Woche', entry: leftover, week: [leftover], expected: '/rezepte/linsensuppe' },
  ])('$name', ({ entry, week, expected }) => {
    expect(recipeLinkTarget(entry, soup, week)).toBe(expected)
  })
})
