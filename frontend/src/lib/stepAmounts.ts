import { canonicalUnit, numberPattern, parseNumber } from './ingredient'
import { formatServings } from './recipes'
import { scaleAmount } from './scale'

/**
 * Löst Mengen-Varianten in Zubereitungsschritten auf, wie HelloFresh sie schreibt:
 * „200 ml [300 ml | 400 ml] Milch“ nennt die Menge für die Rezeptportionen und in der Klammer die
 * Mengen für eine, zwei, … Portionen mehr. Angezeigt wird immer nur eine Menge.
 */

export type StepPart =
  | { kind: 'text'; text: string }
  /** scaledFrom ist gesetzt, wenn keine Variante passte und die Grundmenge umgerechnet wurde. */
  | { kind: 'amount'; text: string; scaledFrom?: string }

const variantsPattern = /\[([^[\]|]+(?:\|[^[\]|]+)+)\]/g
const basePattern = new RegExp(
  String.raw`(?<![\p{L}\d.,])(${numberPattern})(?:\s*[-–]\s*(${numberPattern}))?(?:\s+([\p{L}]+\.?))?\s*$`,
  'u',
)

/**
 * Zerlegt einen Schritt in Text und Mengen. recipeServings sind die Portionen des Rezepts, servings die
 * gewählten; ohne Rezeptportionen oder Auswahl gilt die Grundmenge.
 */
export function resolveStepAmounts(step: string, recipeServings?: number, servings?: number): StepPart[] {
  const parts: StepPart[] = []
  let cursor = 0
  for (const match of step.matchAll(variantsPattern)) {
    const before = step.slice(cursor, match.index)
    const base = basePattern.exec(before)
    const unit = base?.[3]
    if (!base || (unit && !canonicalUnit(unit))) continue

    const baseText = base[0].trim()
    pushText(parts, step.slice(cursor, cursor + base.index))
    const variants = match[1].split('|').map((variant) => variant.trim())
    parts.push(chooseAmount(baseText, base, variants, recipeServings, servings))
    cursor = match.index + match[0].length
  }
  pushText(parts, step.slice(cursor))
  return parts
}

function chooseAmount(
  baseText: string,
  base: RegExpExecArray,
  variants: string[],
  recipeServings: number | undefined,
  servings: number | undefined,
): StepPart {
  if (recipeServings === undefined || servings === undefined || servings === recipeServings) {
    return { kind: 'amount', text: baseText }
  }
  const variant = variants[servings - recipeServings - 1]
  if (variant) return { kind: 'amount', text: variant }

  const first = parseNumber(base[1])
  const second = base[2] !== undefined ? parseNumber(base[2]) : null
  if (first === null) return { kind: 'amount', text: baseText }
  const unitWord = base[3]
  const scaled = scaleAmount(
    second !== null
      ? { quantityMin: first, quantity: second, unit: unitWord && canonicalUnit(unitWord) }
      : { quantity: first, unit: unitWord && canonicalUnit(unitWord) },
    servings / recipeServings,
  )
  return {
    kind: 'amount',
    text: [scaled.quantity, scaled.unit].filter(Boolean).join(' '),
    scaledFrom: `${baseText} für ${formatServings(recipeServings)}`,
  }
}

function pushText(parts: StepPart[], text: string) {
  if (text) parts.push({ kind: 'text', text })
}
