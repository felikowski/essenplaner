import { describe, expect, it } from 'vitest'
import { resolveStepAmounts, type StepPart } from './stepAmounts'

/** Zeigt die Teile als Text; umgerechnete Mengen stehen in _Unterstrichen_. */
function render(parts: StepPart[]): string {
  return parts.map((part) => (part.kind === 'amount' && part.scaledFrom ? `_${part.text}_` : part.text)).join('')
}

// Echte Schritte aus dem HelloFresh-Rezept „Kaspressknödel“ (2 Portionen)
const milk = 'Brotwürfel, 200 ml [300 ml | 400 ml] Milch*, 0,5 TL [0,75 TL | 1 TL] Salz* und Pfeffer* mischen.'
const oil = 'Die Hälfte Preiselbeerenmarmelade, 1 EL [1,5 EL | 2 EL] Balsamicoessig* und 1 EL [1,5 EL | 2 EL] Öl* verrühren.'
const dumplings = 'Aus dem Knödelteig ca. 6 [9 | 12] flache Knödel formen. In einer zweiten großen Pfanne ca. 100 ml Öl* erwärmen.'
const time = 'Die Hälfte der Zwiebel 4 – 5 Min. anbraten. Mit 2 EL [3 EL | 4 EL] Wasser* ablöschen.'

describe('resolveStepAmounts', () => {
  it.each([
    { step: milk, servings: undefined, expected: 'Brotwürfel, 200 ml Milch*, 0,5 TL Salz* und Pfeffer* mischen.' },
    { step: milk, servings: 2, expected: 'Brotwürfel, 200 ml Milch*, 0,5 TL Salz* und Pfeffer* mischen.' },
    { step: milk, servings: 3, expected: 'Brotwürfel, 300 ml Milch*, 0,75 TL Salz* und Pfeffer* mischen.' },
    { step: milk, servings: 4, expected: 'Brotwürfel, 400 ml Milch*, 1 TL Salz* und Pfeffer* mischen.' },
    { step: milk, servings: 6, expected: 'Brotwürfel, _600 ml_ Milch*, _1½ TL_ Salz* und Pfeffer* mischen.' },
    { step: milk, servings: 1, expected: 'Brotwürfel, _100 ml_ Milch*, _¼ TL_ Salz* und Pfeffer* mischen.' },
    { step: oil, servings: 3, expected: 'Die Hälfte Preiselbeerenmarmelade, 1,5 EL Balsamicoessig* und 1,5 EL Öl* verrühren.' },
    { step: dumplings, servings: undefined, expected: 'Aus dem Knödelteig ca. 6 flache Knödel formen. In einer zweiten großen Pfanne ca. 100 ml Öl* erwärmen.' },
    { step: dumplings, servings: 4, expected: 'Aus dem Knödelteig ca. 12 flache Knödel formen. In einer zweiten großen Pfanne ca. 100 ml Öl* erwärmen.' },
    { step: dumplings, servings: 5, expected: 'Aus dem Knödelteig ca. _15_ flache Knödel formen. In einer zweiten großen Pfanne ca. 100 ml Öl* erwärmen.' },
    { step: time, servings: 3, expected: 'Die Hälfte der Zwiebel 4 – 5 Min. anbraten. Mit 3 EL Wasser* ablöschen.' },
    // Ohne erkennbare Grundmenge oder ohne „|“ bleibt alles stehen
    { step: 'Mit 2 großen [3 | 4] Eiern verrühren.', servings: 3, expected: 'Mit 2 großen [3 | 4] Eiern verrühren.' },
    { step: 'Backen [siehe Tipp] und servieren.', servings: 3, expected: 'Backen [siehe Tipp] und servieren.' },
    { step: 'Nur Text [a | b] ohne Menge.', servings: 3, expected: 'Nur Text [a | b] ohne Menge.' },
    { step: '1-2 EL [2-3 EL | 3-4 EL] Senf', servings: 8, expected: '_4–8 EL_ Senf' },
  ])('$servings Portionen: $step', ({ step, servings, expected }) => {
    expect(render(resolveStepAmounts(step, 2, servings))).toBe(expected)
  })

  it('nennt bei umgerechneten Mengen die Grundmenge', () => {
    const parts = resolveStepAmounts('200 ml [300 ml | 400 ml] Milch', 2, 6)
    expect(parts[0]).toEqual({ kind: 'amount', text: '600 ml', scaledFrom: '200 ml für 2 Portionen' })
  })

  it('zeigt ohne Rezeptportionen die Grundmenge', () => {
    expect(render(resolveStepAmounts('6 [9 | 12] Knödel', undefined, 4))).toBe('6 Knödel')
  })

  it('lässt Text ohne Klammer als ein Stück', () => {
    expect(resolveStepAmounts('Zwiebel 4 – 5 Min. anbraten.', 2, 3)).toEqual([
      { kind: 'text', text: 'Zwiebel 4 – 5 Min. anbraten.' },
    ])
  })
})
