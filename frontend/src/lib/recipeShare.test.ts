import { describe, expect, it } from 'vitest'
import type { Recipe } from '../types'
import { recipeShareText } from './recipeShare'

describe('recipeShareText', () => {
  it('teilt die Zutaten für die gewählten Portionen samt Schritten und Quelle', () => {
    const recipe: Recipe = {
      id: 'suppe',
      title: 'Suppe',
      source: { kind: 'web', url: 'https://example.com/suppe' },
      servings: 4,
      ingredients: [{ text: '200 g Karotten', quantity: 200, unit: 'g', name: 'Karotten' }],
      instructions: ['10 Minuten kochen.'],
    }
    const text = recipeShareText(recipe, 8)
    expect(text).toContain('8 Portionen')
    expect(text).toContain('- 400 g Karotten')
    expect(text).toContain('1. 10 Minuten kochen.')
    expect(text).toContain('Quelle: https://example.com/suppe')
  })
})
