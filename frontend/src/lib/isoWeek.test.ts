import { describe, expect, it } from 'vitest'
import {
  currentWeek,
  daysOfWeek,
  formatDayMonth,
  formatWeekday,
  formatWeekLabel,
  isValidWeek,
  nextWeek,
  previousWeek,
  toIsoDate,
  weekOf,
} from './isoWeek'

describe('isoWeek', () => {
  it('ordnet den 30.09.2026 der KW 40/2026 zu', () => {
    expect(currentWeek(new Date(2026, 8, 30, 18, 30))).toBe('2026-W40')
  })

  it('liefert die Tage einer Woche von Montag bis Sonntag', () => {
    expect(daysOfWeek('2026-W40')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })

  it('wechselt von KW 53/2026 auf KW 1/2027, die am 04.01.2027 beginnt', () => {
    expect(isValidWeek('2026-W53')).toBe(true)
    expect(nextWeek('2026-W53')).toBe('2027-W01')
    expect(daysOfWeek('2027-W01')[0]).toBe('2027-01-04')
    expect(previousWeek('2027-W01')).toBe('2026-W53')
  })

  it('ordnet Tage am Jahreswechsel der richtigen KW zu', () => {
    expect(weekOf(new Date(2026, 11, 31))).toBe('2026-W53')
    expect(weekOf(new Date(2027, 0, 3))).toBe('2026-W53')
    expect(weekOf(new Date(2027, 0, 4))).toBe('2027-W01')
    // 2025 hat nur 52 Wochen, der 29.12.2025 gehört zu KW 1/2026.
    expect(weekOf(new Date(2025, 11, 29))).toBe('2026-W01')
    expect(nextWeek('2025-W52')).toBe('2026-W01')
  })

  it('blättert über Sommer- und Winterzeitumstellung hinweg', () => {
    expect(nextWeek('2026-W13')).toBe('2026-W14')
    expect(daysOfWeek('2026-W43')).toContain('2026-10-25')
    expect(nextWeek('2026-W43')).toBe('2026-W44')
  })

  it('erkennt ungültige Wochen', () => {
    expect(isValidWeek('2025-W53')).toBe(false)
    expect(isValidWeek('2026-W00')).toBe(false)
    expect(isValidWeek('2026-40')).toBe(false)
    expect(isValidWeek('abc')).toBe(false)
  })

  it('formatiert Woche und Tag auf Deutsch', () => {
    expect(formatWeekLabel('2026-W40')).toBe('KW 40 · 2026')
    expect(formatWeekLabel('2027-W01')).toBe('KW 1 · 2027')
    expect(formatWeekday('2026-09-30')).toBe('Mittwoch')
    expect(formatWeekday('2026-10-04')).toBe('Sonntag')
    expect(formatDayMonth('2026-10-04')).toBe('04.10.')
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
