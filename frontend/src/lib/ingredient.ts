import type { Ingredient } from '../types'

/**
 * Zerlegt Zutatenzeilen wie „200 g Mehl, gesiebt“ in Menge, Einheit, Name und Hinweis.
 *
 * Gleiche Logik wie im Backend (backend/internal/ingredient). Beide werden mit
 * testdata/ingredient-cases.json im Repository-Wurzelverzeichnis geprüft. Gespeichert wird immer das
 * Ergebnis des Backends; diese Fassung dient der Vorschau beim Tippen.
 */

export interface ParsedIngredient extends Ingredient {
  /** Bei Spannen („1–2“) die untere Grenze; quantity ist dann die obere. */
  quantityMin?: number
}

const unitVariants: Record<string, string[]> = {
  g: ['g', 'gr', 'gramm'],
  kg: ['kg', 'kilo', 'kilogramm'],
  mg: ['mg', 'milligramm'],
  ml: ['ml', 'milliliter'],
  cl: ['cl', 'zentiliter'],
  dl: ['dl', 'deziliter'],
  l: ['l', 'liter'],
  cm: ['cm'],
  TL: ['tl', 'teel', 'teelöffel'],
  EL: ['el', 'essl', 'esslöffel', 'eßlöffel'],
  'Msp.': ['msp', 'messerspitze', 'messerspitzen'],
  Prise: ['prise', 'prisen', 'pr'],
  Tasse: ['tasse', 'tassen'],
  Becher: ['becher'],
  Glas: ['glas', 'gläser'],
  Dose: ['dose', 'dosen', 'ds'],
  'Pck.': ['pck', 'pkg', 'päckchen', 'packung', 'packungen', 'pack'],
  Bund: ['bund', 'bd'],
  Stück: ['stück', 'stücke', 'stk', 'st'],
  Scheibe: ['scheibe', 'scheiben'],
  Zehe: ['zehe', 'zehen'],
  Zweig: ['zweig', 'zweige'],
  Blatt: ['blatt', 'blätter'],
  Handvoll: ['handvoll'],
  Tropfen: ['tropfen'],
  Würfel: ['würfel'],
  Kopf: ['kopf', 'köpfe'],
  Stange: ['stange', 'stangen'],
}

const units = new Map<string, string>(
  Object.entries(unitVariants).flatMap(([canonical, variants]) => variants.map((variant) => [variant, canonical])),
)

const fractions: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅕': 0.2 }

// Reihenfolge zählt: Brüche („1/2“) vor ganzen Zahlen, sonst würde nur „1“ erkannt.
export const numberPattern = String.raw`(?:\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[½⅓⅔¼¾⅛⅕]|\s+\d+\/\d+)?|[½⅓⅔¼¾⅛⅕])`
const bulletPrefix = /^[-–•*·]\s+/
const approxPrefix = /^(?:ca\.?|etwa|circa)\s+/i
const quantityStart = new RegExp(String.raw`^(${numberPattern})(?:\s*(?:-|–|—|bis)\s*(${numberPattern}))?`)

export function parseIngredient(line: string): ParsedIngredient {
  const text = line.trim().split(/\s+/).filter(Boolean).join(' ')
  let rest = text.replace(bulletPrefix, '')
  const afterApprox = rest.replace(approxPrefix, '')

  const match = quantityStart.exec(afterApprox)
  const first = match ? parseNumber(match[1]) : null
  if (!match || first === null) return { text, name: rest }

  let quantity = first
  let quantityMin: number | undefined
  const upper = match[2] ? parseNumber(match[2]) : null
  if (upper !== null) {
    quantityMin = first
    quantity = upper
  }

  rest = afterApprox.slice(match[0].length).trim()
  let unit: string | undefined
  const [word, remainder] = splitFirstWord(rest)
  if (word && remainder) {
    const canonical = canonicalUnit(word)
    if (canonical) {
      unit = canonical
      rest = remainder
    }
  }

  const comma = rest.indexOf(',')
  const name = (comma >= 0 ? rest.slice(0, comma) : rest).trim()
  const note = comma >= 0 ? rest.slice(comma + 1).trim() : ''
  // Nur eine Menge ohne Namen, etwa „2“: dann ist die ganze Zeile der Name.
  if (!name) return { text, name: text }

  const result: ParsedIngredient = { text, quantity, name }
  if (quantityMin !== undefined) result.quantityMin = quantityMin
  if (unit) result.unit = unit
  if (note) result.note = note
  return result
}

/** Zerlegt mehrere Zeilen und verwirft leere. */
export function parseIngredients(lines: string[]): ParsedIngredient[] {
  return lines.filter((line) => line.trim() !== '').map(parseIngredient)
}

/** Einheit in Kurzform, etwa „Teelöffel“ → „TL“; undefined, wenn das Wort keine bekannte Einheit ist. */
export function canonicalUnit(word: string): string | undefined {
  return units.get(word.toLowerCase().replace(/\.$/, ''))
}

function splitFirstWord(s: string): [string, string] {
  const space = s.search(/\s/)
  if (space < 0) return [s, '']
  return [s.slice(0, space), s.slice(space).trim()]
}

/** Liest „2“, „1,5“, „1.5“, „1/2“, „½“, „1½“, „1 ½“ und „1 1/2“. */
export function parseNumber(s: string): number | null {
  const parts = s.trim().split(/\s+/)
  let total = 0
  for (const part of parts) {
    const value = parsePart(part)
    if (value === null) return null
    total += value
  }
  return parts.length > 0 ? total : null
}

function parsePart(part: string): number | null {
  const last = part.slice(-1)
  if (last in fractions) {
    if (part.length === 1) return fractions[last]
    const whole = Number.parseInt(part.slice(0, -1), 10)
    return Number.isNaN(whole) ? null : whole + fractions[last]
  }
  if (part.includes('/')) {
    const [numerator, denominator] = part.split('/').map((value) => Number.parseInt(value, 10))
    if (Number.isNaN(numerator) || Number.isNaN(denominator) || denominator === 0) return null
    return numerator / denominator
  }
  const value = Number.parseFloat(part.replace(',', '.'))
  return Number.isNaN(value) ? null : value
}

const quantityFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

/** Kurzform für die Vorschau im Formular, zum Beispiel „2 · EL · Olivenöl“. */
export function describeIngredient(ingredient: ParsedIngredient): string {
  const parts: string[] = []
  if (ingredient.quantity !== undefined) {
    parts.push(
      ingredient.quantityMin !== undefined
        ? `${quantityFormat.format(ingredient.quantityMin)}–${quantityFormat.format(ingredient.quantity)}`
        : quantityFormat.format(ingredient.quantity),
    )
  }
  if (ingredient.unit) parts.push(ingredient.unit)
  parts.push(ingredient.name)
  return parts.join(' · ') + (ingredient.note ? ` (${ingredient.note})` : '')
}
