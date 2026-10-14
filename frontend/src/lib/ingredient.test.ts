import { describe, expect, it } from 'vitest'
import sharedCases from '../../../testdata/ingredient-cases.json'
import { describeIngredient, parseIngredient, parseIngredients } from './ingredient'

interface TestCase {
  line: string
  quantity?: number
  quantityMin?: number
  unit?: string
  name: string
  note?: string
}

// Dieselben Fälle prüft das Backend (backend/internal/ingredient/ingredient_test.go).
const cases: TestCase[] = sharedCases

function expectNumber(received: number | undefined, expected: number | undefined) {
  if (expected === undefined) expect(received).toBeUndefined()
  else expect(received).toBeCloseTo(expected, 9)
}

describe('parseIngredient', () => {
  it('hat genug gemeinsame Testfälle', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40)
  })

  it.each(cases)('zerlegt „$line“ wie das Backend', ({ line, quantity, quantityMin, unit, name, note }) => {
    const got = parseIngredient(line)
    expectNumber(got.quantity, quantity)
    expectNumber(got.quantityMin, quantityMin)
    expect(got.unit ?? '').toBe(unit ?? '')
    expect(got.name).toBe(name)
    expect(got.note ?? '').toBe(note ?? '')
  })

  it('behält den eingegebenen Text mit vereinfachtem Leerraum', () => {
    expect(parseIngredient('  1-2   Knoblauchzehen ').text).toBe('1-2 Knoblauchzehen')
  })

  it('verwirft leere Zeilen', () => {
    expect(parseIngredients(['200 g Mehl', '', '  ', '2 Eier']).map((i) => i.name)).toEqual(['Mehl', 'Eier'])
  })
})

describe('describeIngredient', () => {
  it('zeigt Menge, Einheit und Name', () => {
    expect(describeIngredient(parseIngredient('2 EL Olivenöl'))).toBe('2 · EL · Olivenöl')
    expect(describeIngredient(parseIngredient('1,5 l Brühe'))).toBe('1,5 · l · Brühe')
    expect(describeIngredient(parseIngredient('1-2 Knoblauchzehen'))).toBe('1–2 · Knoblauchzehen')
    expect(describeIngredient(parseIngredient('3 Zwiebeln, gewürfelt'))).toBe('3 · Zwiebeln (gewürfelt)')
    expect(describeIngredient(parseIngredient('Salz und Pfeffer'))).toBe('Salz und Pfeffer')
  })
})
