import { describe, expect, it } from 'vitest'
import { findStepTimes } from './stepTimes'

describe('findStepTimes', () => {
  it.each([
    ['10 Minuten köcheln', '10 Minuten', 600_000],
    ['10 Min. köcheln', '10 Min.', 600_000],
    ['1 Std. ruhen', '1 Std.', 3_600_000],
    ['1 ½ Stunden backen', '1 ½ Stunden', 5_400_000],
    ['30 Sekunden rühren', '30 Sekunden', 30_000],
    ['5–7 Minuten braten', '5–7 Minuten', 300_000],
    ['5 bis 7 Min. ziehen lassen', '5 bis 7 Min.', 300_000],
  ])('erkennt %s', (text, label, durationMs) => {
    expect(findStepTimes(text)).toContainEqual({ kind: 'time', text: label, durationMs })
  })

  it('lässt Text ohne Zeitangabe unverändert', () => {
    expect(findStepTimes('Mit Salz abschmecken.')).toEqual([{ kind: 'text', text: 'Mit Salz abschmecken.' }])
  })
})
