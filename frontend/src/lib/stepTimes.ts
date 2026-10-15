import { numberPattern, parseNumber } from './ingredient'

export type TimedTextPart =
  | { kind: 'text'; text: string }
  | { kind: 'time'; text: string; durationMs: number }

const timePattern = new RegExp(
  String.raw`(${numberPattern})(?:\s*(?:-|–|—|bis)\s*(${numberPattern}))?\s*(Sekunden?|Sek\.?|Minuten?|Min\.?|Stunden?|Std\.?)`,
  'giu',
)

/** Zerlegt Schritttext in Text und antippbare Zeitangaben. Bei Spannen gilt die untere Grenze. */
export function findStepTimes(text: string): TimedTextPart[] {
  const parts: TimedTextPart[] = []
  let cursor = 0
  for (const match of text.matchAll(timePattern)) {
    if (match.index > cursor) parts.push({ kind: 'text', text: text.slice(cursor, match.index) })
    const amount = parseNumber(match[1])
    const unit = match[3].toLocaleLowerCase('de')
    if (amount !== null) {
      const factor = unit.startsWith('std') || unit.startsWith('stunde') ? 3_600_000 : unit.startsWith('min') ? 60_000 : 1_000
      parts.push({ kind: 'time', text: match[0], durationMs: amount * factor })
    } else {
      parts.push({ kind: 'text', text: match[0] })
    }
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) })
  return parts.length > 0 ? parts : [{ kind: 'text', text }]
}
