import { describe, expect, it } from 'vitest'
import { SUBSTITUTIONS, substitutionsFor } from './substitutions'

describe('substitutionsFor', () => {
  it('enthält mindestens 30 Zutaten und rechnet Buttermilch passend vor', () => {
    expect(SUBSTITUTIONS.length).toBeGreaterThanOrEqual(30)
    expect(substitutionsFor({ text: '200 ml Buttermilch', quantity: 200, unit: 'ml', name: 'Buttermilch' })).toEqual({
      name: 'Buttermilch',
      suggestions: ['200 ml Milch + 1 EL Zitronensaft, 10 Minuten stehen lassen'],
    })
  })

  it('findet Varianten ohne Beachtung der Großschreibung', () => {
    expect(substitutionsFor({ text: 'Feta', name: 'SCHAFSKÄSE' })?.suggestions[0]).toContain('Hirtenkäse')
  })

  it('liefert für unbekannte Zutaten keinen Treffer', () => {
    expect(substitutionsFor({ text: '2 Zucchini', quantity: 2, name: 'Zucchini' })).toBeNull()
  })
})
