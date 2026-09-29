import type { Recipe } from '../types'

const collator = new Intl.Collator('de', { sensitivity: 'base' })

export function sortByTitle(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) => collator.compare(a.title, b.title))
}

/** Filtert nach Titel, ohne Groß- und Kleinschreibung zu beachten. */
export function filterByTitle(recipes: Recipe[], query: string): Recipe[] {
  const needle = query.trim().toLocaleLowerCase('de')
  if (!needle) return recipes
  return recipes.filter((recipe) => recipe.title.toLocaleLowerCase('de').includes(needle))
}

export function sourceLabel(recipe: Recipe): string {
  return recipe.source.kind === 'pdf' ? 'PDF' : 'Webseite'
}
