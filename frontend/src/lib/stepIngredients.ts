import type { Ingredient } from '../types'

/**
 * Findet die Zutaten, die ein Zubereitungsschritt erwähnt, über ihre Namen. Eine Heuristik: lieber ein
 * fehlender Treffer als ein falscher. Sammelbegriffe („das Gemüse“) und Pronomen werden nicht aufgelöst.
 */

/** Beschreibende Wörter in Zutatennamen, die allein keine Zutat bezeichnen. */
const descriptiveWords = new Set([
  'rot', 'rote', 'roter', 'rotes', 'grun', 'grune', 'gruner', 'grunes', 'gelb', 'gelbe', 'gelber', 'weiss', 'weisse',
  'weisser', 'schwarz', 'schwarze', 'schwarzer', 'frisch', 'frische', 'frischer', 'frisches', 'getrocknet',
  'getrocknete', 'gemahlen', 'gemahlene', 'gemahlener', 'gehackt', 'gehackte', 'gehackter', 'fein', 'feine', 'grob',
  'grobe', 'klein', 'kleine', 'kleiner', 'gross', 'grosse', 'grosser', 'mittelgross', 'mittelgrosse', 'tk', 'bio',
  'abgetropft', 'abgetropfte', 'geschalt', 'geschalte', 'gekocht', 'gekochte', 'etwas', 'nach', 'belieben',
  'geschmack', 'zum', 'zur', 'fur', 'und', 'oder', 'mit', 'ohne', 'aus', 'der', 'die', 'das', 'dem', 'den',
])

/** Wörter im Schritt, die nicht über zusammengesetzte Zutatennamen treffen dürfen. */
const compoundStopWords = new Set([
  'kochen', 'backen', 'braten', 'anbraten', 'schneiden', 'hacken', 'rosten', 'garen', 'wurfel', 'wurfeln',
  'streifen', 'scheiben', 'ringe', 'stucke', 'topf', 'pfanne', 'ofen', 'blech', 'schussel', 'halfte', 'rest',
  'gemuse', 'zutaten', 'alles', 'masse', 'mischung', 'teig', 'sosse', 'sauce', 'wasser', 'minuten', 'stunden',
  'packung', 'packungsanweisung',
])

/** Endungen für Plural und Fugen, die beim Vergleich abgeschnitten werden. */
const endings = ['ern', 'en', 'er', 'n', 'e', 's']

const minCompoundLength = 4

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ä', 'a')
    .replaceAll('ö', 'o')
    .replaceAll('ü', 'u')
    .replaceAll('ß', 'ss')
}

function words(text: string): string[] {
  return normalize(text).match(/\p{L}+/gu) ?? []
}

/** Das Wort und seine Formen ohne Plural- oder Fugenendung, jeweils mit mindestens zwei Buchstaben. */
function forms(word: string): string[] {
  const result = [word]
  for (const ending of endings) {
    if (word.endsWith(ending) && word.length - ending.length >= 2) result.push(word.slice(0, -ending.length))
  }
  return result
}

function keywords(ingredient: Ingredient): string[] {
  const name = ingredient.name.split(',')[0].replace(/\([^)]*\)/g, ' ')
  return words(name).filter((word) => word.length >= 2 && !descriptiveWords.has(word))
}

function sameWord(a: string[], b: string[]): boolean {
  return a.some((form) => b.includes(form))
}

/** Teil eines zusammengesetzten Worts: Anfang (ganzes Wort) oder Ende (auch ohne Endung). */
function compoundPart(part: string, partForms: string[], whole: string, wholeForms: string[]): boolean {
  if (part.length >= minCompoundLength && part.length < whole.length && whole.startsWith(part)) return true
  return partForms.some((p) => p.length >= minCompoundLength &&
    wholeForms.some((w) => p.length < w.length && w.endsWith(p)))
}

/** Indizes der Zutaten, die der Schritt erwähnt, in der Reihenfolge der Zutatenliste. */
export function findStepIngredients(step: string, ingredients: Ingredient[]): number[] {
  const stepWords = words(step).filter((word) => word.length >= 2)
  const ingredientKeywords = ingredients.map((ingredient) => keywords(ingredient).map((word) => ({ word, forms: forms(word) })))
  const found = new Set<number>()

  for (const stepWord of stepWords) {
    const stepForms = forms(stepWord)
    const exact = ingredientKeywords.flatMap((keys, index) => keys.some((key) => sameWord(stepForms, key.forms)) ? [index] : [])
    if (exact.length > 0) {
      exact.forEach((index) => found.add(index))
      continue
    }
    if (compoundStopWords.has(stepWord) || stepForms.some((form) => compoundStopWords.has(form))) continue
    ingredientKeywords.forEach((keys, index) => {
      if (keys.some((key) => compoundPart(stepWord, stepForms, key.word, key.forms) || compoundPart(key.word, key.forms, stepWord, stepForms))) {
        found.add(index)
      }
    })
  }
  return [...found].sort((a, b) => a - b)
}
