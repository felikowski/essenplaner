import type { Recipe } from '../types'
import { formatServings } from './recipes'
import { scaleIngredient } from './scale'
import { resolveStepAmounts } from './stepAmounts'

/** Textfassung eines Rezepts für das Teilen-Menü beziehungsweise die Zwischenablage. */
export function recipeShareText(recipe: Recipe, servings?: number): string {
  const factor = servings !== undefined && recipe.servings !== undefined ? servings / recipe.servings : 1
  const lines = [recipe.title]
  if (servings !== undefined) lines.push(formatServings(servings))
  if (recipe.ingredients?.length) {
    lines.push('', 'Zutaten', ...recipe.ingredients.map((ingredient) => `- ${scaleIngredient(ingredient, factor)}`))
  }
  if (recipe.instructions?.length) {
    lines.push(
      '',
      'Zubereitung',
      ...recipe.instructions.map((step, index) => `${index + 1}. ${resolveStepAmounts(step, recipe.servings, servings).map((part) => part.text).join('')}`),
    )
  }
  const source = recipe.source.kind === 'web' ? recipe.source.url : recipe.source.kind === 'pdf' ? recipe.source.pdfUrl : null
  if (source) lines.push('', `Quelle: ${source}`)
  return lines.join('\n')
}
