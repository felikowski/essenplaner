import type { PlanEntry, Recipe } from '../types'

/** Kurzname eines Eintrags, zum Beispiel für Dialogtitel. */
export function entryTitle(entry: PlanEntry, recipe: Recipe | undefined): string {
  switch (entry.kind) {
    case 'recipe':
      return recipe?.title ?? 'Rezept'
    case 'leftover':
      return `Reste: ${recipe?.title ?? 'Rezept'}`
    default:
      return entry.text ?? ''
  }
}

/**
 * Link zur Detailansicht des Rezepts. Weichen die Portionen vom Rezept ab, werden sie als `?portionen=`
 * mitgegeben. Reste haben keine eigenen Portionen und nehmen die ihres Originals, sofern es in
 * weekEntries (der angezeigten Woche) steht.
 */
export function recipeLinkTarget(entry: PlanEntry, recipe: Recipe | undefined, weekEntries: PlanEntry[]): string {
  const path = `/rezepte/${entry.recipeId}`
  const source =
    entry.kind === 'leftover' ? weekEntries.find((candidate) => candidate.id === entry.leftoverOf?.id) : entry
  const servings = source?.servings
  return servings !== undefined && servings !== recipe?.servings ? `${path}?portionen=${servings}` : path
}
