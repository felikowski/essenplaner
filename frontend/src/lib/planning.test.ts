import { describe, expect, it } from 'vitest'
import { defaultMeal, plannedNotice } from './planning'

describe('plannedNotice', () => {
  it('nennt Tag und Mahlzeit', () => {
    expect(plannedNotice('2026-10-21', 'dinner')).toBe('Für Mi 21.10. · Abendessen eingeplant')
    expect(plannedNotice('2026-10-26', 'lunch')).toBe('Für Mo 26.10. · Mittagessen eingeplant')
  })
})

describe('defaultMeal', () => {
  it('wählt Abendessen, wenn es sichtbar ist', () => {
    expect(defaultMeal(['breakfast', 'dinner'])).toBe('dinner')
  })

  it('wählt sonst die erste sichtbare Mahlzeit in fester Reihenfolge', () => {
    expect(defaultMeal(['lunch', 'breakfast'])).toBe('breakfast')
    expect(defaultMeal(['snack'])).toBe('snack')
  })

  it('fällt ohne sichtbare Mahlzeit auf Abendessen zurück', () => {
    expect(defaultMeal([])).toBe('dinner')
  })
})
