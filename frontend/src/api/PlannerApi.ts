import type {
  CopyMode,
  CurrentUser,
  EntryPatch,
  HouseholdSettings,
  ApplyMenuResult,
  IsoDate,
  IsoWeek,
  Menu,
  MenuEntryPatch,
  MenuInput,
  MenuSummary,
  NewEntry,
  NewMenuEntry,
  Recipe,
  RecipeInput,
  RecipeOrganizationPatch,
  ShoppingAlias,
  ShoppingImportResult,
  ShoppingItemPatch,
  ShoppingList,
  Staple,
  TagSummary,
  WeekPlan,
} from '../types'

/**
 * Zugriff auf Rezepte und Wochenpläne. Komponenten kennen nur dieses Interface,
 * die Implementierung (heute Dummy-Daten, später das Backend) kommt über den Context.
 */
export interface PlannerApi {
  /** Angemeldeter Nutzer für die Kopfzeile. */
  getMe(): Promise<CurrentUser>
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
  listMenus(): Promise<MenuSummary[]>
  getMenu(id: string): Promise<Menu | null>
  createMenu(input: MenuInput): Promise<Menu>
  updateMenu(id: string, input: Pick<MenuInput, 'name' | 'description'>): Promise<Menu>
  deleteMenu(id: string): Promise<void>
  createMenuEntry(menuId: string, entry: NewMenuEntry): Promise<Menu>
  updateMenuEntry(menuId: string, entryId: string, patch: MenuEntryPatch): Promise<Menu>
  deleteMenuEntry(menuId: string, entryId: string): Promise<Menu>
  appendMenuDay(id: string): Promise<Menu>
  removeMenuDay(id: string, day: number): Promise<Menu>
  applyMenu(id: string, start: IsoDate): Promise<ApplyMenuResult>
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
  /** Ändert nur übergebene Angaben der Einordnung. */
  updateRecipeOrganization(id: string, patch: RecipeOrganizationPatch): Promise<Recipe>
  /** Markiert ein Rezept als nicht mehr verfügbar. */
  removeRecipe(id: string): Promise<void>
  listTags(): Promise<TagSummary[]>
  renameTag(name: string, newName: string): Promise<TagSummary[]>
  deleteTag(name: string): Promise<TagSummary[]>

  /**
   * Lädt die Einkaufsliste. Mit knownVersion liefert sie null, wenn sich seitdem nichts geändert hat.
   * Alle schreibenden Methoden liefern die vollständige Liste.
   */
  getShoppingList(knownVersion?: number): Promise<ShoppingList | null>
  /** Fügt einen Artikel als Zutatenzeile hinzu, etwa „2 Packungen Kaffee“. */
  addShoppingItem(text: string): Promise<ShoppingList>
  updateShoppingItem(id: string, patch: ShoppingItemPatch): Promise<ShoppingList>
  setShoppingItemChecked(id: string, checked: boolean): Promise<ShoppingList>
  deleteShoppingItem(id: string): Promise<ShoppingList>
  /** Führt einen Artikel in einen anderen zusammen und merkt sich das für den Namen. */
  mergeShoppingItem(id: string, targetId: string): Promise<ShoppingList>
  /** Übernimmt die Zutaten der Planeinträge zwischen from und to (einschließlich). */
  importShoppingFromPlan(from: IsoDate, to: IsoDate): Promise<ShoppingImportResult>
  clearCheckedShoppingItems(): Promise<ShoppingList>
  createShoppingCategory(name: string): Promise<ShoppingList>
  renameShoppingCategory(id: string, name: string): Promise<ShoppingList>
  deleteShoppingCategory(id: string): Promise<ShoppingList>
  reorderShoppingCategories(ids: string[]): Promise<ShoppingList>
  createShoppingStore(name: string): Promise<ShoppingList>
  renameShoppingStore(id: string, name: string): Promise<ShoppingList>
  deleteShoppingStore(id: string): Promise<ShoppingList>
  listShoppingAliases(): Promise<ShoppingAlias[]>
  deleteShoppingAlias(fromKey: string): Promise<ShoppingAlias[]>
  listStaples(): Promise<Staple[]>
  createStaple(text: string): Promise<Staple[]>
  deleteStaple(id: string): Promise<Staple[]>
  addStaplesToList(ids: string[]): Promise<ShoppingList>
}
