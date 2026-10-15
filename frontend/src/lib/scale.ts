import type { Ingredient } from '../types'
import { parseIngredient } from './ingredient'

/**
 * Rechnet Mengen für andere Portionen um und rundet sie so, dass man sie in der Küche abmessen kann.
 *
 * Die Regeln stehen in openspec/specs/servings-scaling (Requirement „Zutatenmengen umrechnen“). Die
 * Einkaufsliste rundet später eigenständig zum Einkaufen auf; hier geht es um handliche Werte beim Kochen.
 */

export interface Amount {
  quantity: number
  /** Bei Spannen („1–2“) die untere Grenze; quantity ist dann die obere. */
  quantityMin?: number
  unit?: string
}

export interface ScaledAmount {
  /** Menge als Text, etwa „1,2“, „½“ oder „2–4“ */
  quantity: string
  /** Einheit nach dem Umrechnen; aus g kann kg werden */
  unit?: string
}

const metricUnits: Record<string, { base: 'g' | 'ml'; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
}
const largeUnits = { g: 'kg', ml: 'l' }
const spoonUnits = new Set(['TL', 'EL', 'Tasse', 'Prise'])
const fractionSigns: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' }
const decimalFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

export function scaleAmount(amount: Amount, factor: number): ScaledAmount {
  const values = [amount.quantityMin, amount.quantity]
    .filter((value): value is number => value !== undefined)
    .map((value) => value * factor)

  const metric = amount.unit ? metricUnits[amount.unit] : undefined
  if (metric) {
    const inBase = values.map((value) => value * metric.factor)
    const small = inBase.map((value) => (value >= 100 ? roundTo(value, 5) : Math.max(1, Math.round(value))))
    // Erst runden, dann entscheiden: 999 ml werden zu 1000 ml und damit zu 1 l.
    if (Math.max(...small) < 1000) return { quantity: joinRange(small, String), unit: metric.base }
    const large = inBase.map((value) => Math.max(0.1, roundTo(value / 1000, 0.1)))
    return { quantity: joinRange(large, (value) => decimalFormat.format(value)), unit: largeUnits[metric.base] }
  }

  const step = amount.unit && spoonUnits.has(amount.unit) ? 0.25 : 0.5
  const rounded = values.map((value) => Math.max(step, roundTo(value, step)))
  return { quantity: joinRange(rounded, formatFraction), unit: amount.unit }
}

/** Anzeigetext einer Zutat für den Faktor gewählte Portionen / Rezeptportionen. */
export function scaleIngredient(ingredient: Ingredient, factor: number): string {
  if (factor === 1 || ingredient.quantity === undefined) return ingredient.text

  // Das Backend speichert bei Spannen nur die obere Grenze; die untere liefert der Frontend-Parser.
  const parsed = parseIngredient(ingredient.text)
  const quantityMin = parsed.quantity === ingredient.quantity ? parsed.quantityMin : undefined
  const scaled = scaleAmount({ quantity: ingredient.quantity, quantityMin, unit: ingredient.unit }, factor)
  const approx = /^(?:[-–•*·]\s+)?(ca\.?|etwa|circa)\s/i.exec(ingredient.text)?.[1]

  const text = [approx, scaled.quantity, scaled.unit, ingredient.name].filter(Boolean).join(' ')
  return ingredient.note ? `${text}, ${ingredient.note}` : text
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

function joinRange(values: number[], format: (value: number) => string): string {
  const [first, last] = [values[0], values[values.length - 1]]
  return Math.abs(first - last) < 1e-9 ? format(last) : `${format(first)}–${format(last)}`
}

/** 0,25 → „¼“, 1,5 → „1½“, 2 → „2“; erwartet Vielfache von ¼. */
function formatFraction(value: number): string {
  const whole = Math.floor(value + 1e-9)
  const sign = fractionSigns[Math.round((value - whole) * 4) / 4]
  if (!sign) return String(whole)
  return whole === 0 ? sign : `${whole}${sign}`
}
