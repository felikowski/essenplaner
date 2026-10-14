import type {
  CopyMode,
  EntryPatch,
  HouseholdSettings,
  IsoDate,
  IsoWeek,
  NewEntry,
  Recipe,
  RecipeInput,
  WeekPlan,
} from '../types'

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
  /** Legt einen Eintrag am Ende seiner Mahlzeit an und liefert die Pläne der betroffenen Wochen. */
  createEntry(entry: NewEntry): Promise<WeekPlan[]>
  /** Ändert einen Eintrag (beim Verschieben über eine Wochengrenze kommen beide Wochen zurück). */
  updateEntry(id: string, patch: EntryPatch): Promise<WeekPlan[]>
  /** Löscht einen Eintrag; Reste, die auf ihn verweisen, werden zu Notizen. */
  deleteEntry(id: string): Promise<WeekPlan[]>
  /** Kopiert alle Einträge einer Woche in eine andere. */
  copyWeek(from: IsoWeek, to: IsoWeek, mode: CopyMode): Promise<{ week: WeekPlan; skipped: number }>
  /** Daten, an denen ein Rezept geplant war (ohne Reste), neueste zuerst. */
  getRecipeHistory(id: string): Promise<IsoDate[]>
  getSettings(): Promise<HouseholdSettings>
  updateSettings(patch: Partial<HouseholdSettings>): Promise<HouseholdSettings>
  /**
   * Importiert ein Rezept von einer Webseite. Liefert bei einem Duplikat das vorhandene Rezept.
   * Wirft RequestError mit serverMessage, wenn der Import scheitert.
   */
  importRecipe(url: string): Promise<Recipe>
  /** Legt ein eigenes Rezept an. Wirft RequestError mit field bei ungültigen Eingaben. */
  createRecipe(input: RecipeInput): Promise<Recipe>
  /** Ersetzt die bearbeitbaren Angaben eines Rezepts. Wirft RequestError mit field bei ungültigen Eingaben. */
  updateRecipe(id: string, input: RecipeInput): Promise<Recipe>
  /** Markiert ein Rezept als nicht mehr verfügbar. */
  removeRecipe(id: string): Promise<void>
}
