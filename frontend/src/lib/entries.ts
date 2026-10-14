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
