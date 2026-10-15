import { describe, expect, it } from 'vitest'
import type { Ingredient } from '../types'
import { parseIngredient } from './ingredient'
import { scaleAmount, scaleIngredient } from './scale'

/** Zutat wie vom Backend gespeichert: zerlegt, aber ohne untere Grenze bei Spannen. */
function stored(text: string): Ingredient {
  const { quantityMin: _ignored, ...ingredient } = parseIngredient(text)
  return ingredient
}

describe('scaleIngredient', () => {
  it.each([
    // Szenarien aus servings-scaling
    { text: '600 g Hähnchenbrust', factor: 2, expected: '1,2 kg Hähnchenbrust' },
    { text: '1 EL Currypulver', factor: 2, expected: '2 EL Currypulver' },
    { text: '1 TL Salz', factor: 0.5, expected: '½ TL Salz' },
    { text: '3 Eier', factor: 0.5, expected: '1½ Eier' },
    { text: '250 g Steinofenbaguette', factor: 1.5, expected: '375 g Steinofenbaguette' },
    { text: '1-2 Knoblauchzehen', factor: 2, expected: '2–4 Knoblauchzehen' },
    { text: 'Salz und Pfeffer', factor: 2, expected: 'Salz und Pfeffer' },
    // g und ml
    { text: '8 ml Worcester Sauce', factor: 1.5, expected: '12 ml Worcester Sauce' },
    { text: '10 g Hefe', factor: 0.03, expected: '1 g Hefe' },
    { text: '150 g Kochsahne', factor: 1.5, expected: '225 g Kochsahne' },
    { text: '125 ml Wasser', factor: 1.5, expected: '190 ml Wasser' },
    { text: '200 ml Milch', factor: 5, expected: '1 l Milch' },
    { text: '1 kg Kartoffeln', factor: 0.5, expected: '500 g Kartoffeln' },
    { text: '1,5 l Brühe', factor: 1.5, expected: '2,3 l Brühe' },
    { text: '800 g Mehl', factor: 1.5, expected: '1,2 kg Mehl' },
    // Löffelmaße auf Viertel
    { text: '½ Teelöffel Salz', factor: 1.5, expected: '¾ TL Salz' },
    { text: '2 Esslöffel Butter', factor: 1.5, expected: '3 EL Butter' },
    { text: '1 EL Öl', factor: 1.25, expected: '1¼ EL Öl' },
    { text: '1 Prise Zucker', factor: 0.1, expected: '¼ Prise Zucker' },
    { text: '1 Tasse Reis', factor: 2.5, expected: '2½ Tasse Reis' },
    // Rest auf Halbe, mindestens ½
    { text: '1 Stück Zwiebel', factor: 1.5, expected: '1½ Stück Zwiebel' },
    { text: '1 Dose Tomaten', factor: 0.25, expected: '½ Dose Tomaten' },
    { text: '3 Eier', factor: 1.3, expected: '4 Eier' },
    // Hinweis und „ca.“ bleiben erhalten, Spanne fällt zusammen
    { text: '200 g Wirsing, geschnitten', factor: 1.5, expected: '300 g Wirsing, geschnitten' },
    { text: 'ca. 100 ml Öl', factor: 2, expected: 'ca. 200 ml Öl' },
    { text: '1-1,2 kg Rindfleisch', factor: 0.1, expected: '100–120 g Rindfleisch' },
    { text: '2-3 Zwiebeln', factor: 0.1, expected: '½ Zwiebeln' },
  ])('$text × $factor → $expected', ({ text, factor, expected }) => {
    expect(scaleIngredient(stored(text), factor)).toBe(expected)
  })

  it('lässt bei Faktor 1 den eingegebenen Text stehen', () => {
    expect(scaleIngredient(stored('½ Teelöffel Salz'), 1)).toBe('½ Teelöffel Salz')
  })
})

describe('scaleAmount', () => {
  it.each([
    { amount: { quantity: 99, unit: 'g' }, factor: 1, expected: { quantity: '99', unit: 'g' } },
    { amount: { quantity: 103, unit: 'g' }, factor: 1, expected: { quantity: '105', unit: 'g' } },
    { amount: { quantity: 999, unit: 'ml' }, factor: 1, expected: { quantity: '1', unit: 'l' } },
    { amount: { quantity: 1000, unit: 'ml' }, factor: 1, expected: { quantity: '1', unit: 'l' } },
    { amount: { quantity: 0.3 }, factor: 1, expected: { quantity: '½', unit: undefined } },
    { amount: { quantity: 7 }, factor: 1, expected: { quantity: '7', unit: undefined } },
  ])('$amount.quantity $amount.unit → $expected.quantity $expected.unit', ({ amount, factor, expected }) => {
    expect(scaleAmount(amount, factor)).toEqual(expected)
  })
})
