import type { IsoDate, IsoWeek, Recipe, WeekPlan } from '../types'

/**
 * Zugriff auf Rezepte und Wochenpläne. Komponenten kennen nur dieses Interface,
 * die Implementierung (heute Dummy-Daten, später das Backend) kommt über den Context.
 */
export interface PlannerApi {
  listRecipes(): Promise<Recipe[]>
  /** null, wenn es kein Rezept mit dieser ID gibt. */
  getRecipe(id: string): Promise<Recipe | null>
  /** Liefert immer alle sieben Tage, auch für Wochen ohne gespeicherten Plan. */
  getWeek(week: IsoWeek): Promise<WeekPlan>
  /** Ordnet einem Tag ein Rezept zu (null entfernt die Zuordnung) und liefert den neuen Wochenplan. */
  setDay(date: IsoDate, recipeId: string | null): Promise<WeekPlan>
}
