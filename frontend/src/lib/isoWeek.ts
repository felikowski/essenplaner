import type { IsoDate, IsoWeek } from '../types'

// Gerechnet wird ausschließlich mit lokalen Kalenderdaten (Date mit Uhrzeit 00:00
// in lokaler Zeit), nie mit UTC-Zeitstempeln. new Date(y, m, d + n) ist dabei
// sicher gegenüber Sommer-/Winterzeit.

export const WEEKDAY_LABELS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const

const WEEK_PATTERN = /^(\d{4})-W(\d{2})$/
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

interface WeekParts {
  year: number
  week: number
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** 0 = Montag … 6 = Sonntag */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function mondayOfWeekOne(year: number): Date {
  // Die KW 1 ist die Woche, die den 4. Januar enthält.
  const jan4 = new Date(year, 0, 4)
  return addDays(jan4, -weekdayIndex(jan4))
}

function formatWeek({ year, week }: WeekParts): IsoWeek {
  return `${year}-W${pad(week)}`
}

function weeksInYear(year: number): number {
  // Der 28. Dezember liegt immer in der letzten KW des Jahres.
  return weekPartsOf(new Date(year, 11, 28)).week
}

function weekPartsOf(date: Date): WeekParts {
  // Das Jahr der KW ist das Jahr, in dem der Donnerstag dieser Woche liegt.
  const thursday = addDays(date, 3 - weekdayIndex(date))
  const year = thursday.getFullYear()
  const firstMonday = mondayOfWeekOne(year)
  const days = Math.round(
    (Date.UTC(thursday.getFullYear(), thursday.getMonth(), thursday.getDate()) -
      Date.UTC(firstMonday.getFullYear(), firstMonday.getMonth(), firstMonday.getDate())) /
      86_400_000,
  )
  return { year, week: Math.floor(days / 7) + 1 }
}

function parseWeek(week: string): WeekParts | null {
  const match = WEEK_PATTERN.exec(week)
  if (!match) return null
  const parts = { year: Number(match[1]), week: Number(match[2]) }
  if (parts.week < 1 || parts.week > weeksInYear(parts.year)) return null
  return parts
}

function mondayOf(week: IsoWeek): Date {
  const parts = parseWeek(week)
  if (!parts) throw new Error(`Ungültige Kalenderwoche: ${week}`)
  return addDays(mondayOfWeekOne(parts.year), (parts.week - 1) * 7)
}

export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseIsoDate(value: IsoDate): Date {
  const match = DATE_PATTERN.exec(value)
  if (!match) throw new Error(`Ungültiges Datum: ${value}`)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function isValidWeek(week: string): week is IsoWeek {
  return parseWeek(week) !== null
}

export function weekOf(date: Date): IsoWeek {
  return formatWeek(weekPartsOf(date))
}

export function currentWeek(now: Date = new Date()): IsoWeek {
  return weekOf(now)
}

export function shiftWeek(week: IsoWeek, delta: number): IsoWeek {
  return weekOf(addDays(mondayOf(week), delta * 7))
}

export function previousWeek(week: IsoWeek): IsoWeek {
  return shiftWeek(week, -1)
}

export function nextWeek(week: IsoWeek): IsoWeek {
  return shiftWeek(week, 1)
}

/** Die sieben Tage einer Woche, von Montag bis Sonntag. */
export function daysOfWeek(week: IsoWeek): IsoDate[] {
  const monday = mondayOf(week)
  return Array.from({ length: 7 }, (_, index) => toIsoDate(addDays(monday, index)))
}

/** "KW 40 · 2026" */
export function formatWeekLabel(week: IsoWeek): string {
  const parts = parseWeek(week)
  if (!parts) throw new Error(`Ungültige Kalenderwoche: ${week}`)
  return `KW ${parts.week} · ${parts.year}`
}

/** "Montag" */
export function formatWeekday(date: IsoDate): string {
  return WEEKDAY_LABELS[weekdayIndex(parseIsoDate(date))]
}

/** "28.09." */
export function formatDayMonth(date: IsoDate): string {
  const parsed = parseIsoDate(date)
  return `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}.`
}
