import recipes from '../../public/mock/recipes.json'
import weeks from '../../public/mock/weeks.json'
import type { JsonLoader } from '../api/MockPlannerApi'

export const mockRecipes: unknown = recipes
export const mockWeeks: unknown = weeks

/** Liefert die Dummy-Daten aus `public/mock` ohne Netzwerk. */
export const loadMockFiles: JsonLoader = async (file) => {
  if (file === 'recipes.json') return structuredClone(recipes)
  if (file === 'weeks.json') return structuredClone(weeks)
  throw new Error(`Unbekannte Datei: ${file}`)
}
