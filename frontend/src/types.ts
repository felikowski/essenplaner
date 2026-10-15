export type RecipeSource =
  | { kind: 'pdf'; pdfUrl: string }
  | { kind: 'web'; url: string }
  | { kind: 'manual' }

/** Zerlegte Zutat. text ist die eingegebene Zeile und wird angezeigt; die übrigen Felder dienen dem Rechnen. */
export interface Ingredient {
  text: string
  quantity?: number
  unit?: string
  name: string
  note?: string
}

export interface Recipe {
  id: string
  title: string
  source: RecipeSource
  imageUrl?: string
  /** Anzahl Portionen, 1 bis 99. */
  servings?: number
  ingredients?: Ingredient[]
  instructions?: string[]
  /** false, wenn das Rezept entfernt wurde. Es bleibt dann nur in bestehenden Plänen sichtbar. Fehlt = verfügbar. */
  available?: boolean
  /** true, wenn sich das Rezept entfernen lässt (importierte und eigene Rezepte). */
  removable?: boolean
  /** true, wenn sich der Titel ändern lässt (nur bei eigenen Rezepten). */
  titleEditable?: boolean
  course?: RecipeCourse
  cuisine?: string
  tags?: string[]
  rating?: number
  toTry?: boolean
  notes?: string
  totalMinutes?: number
  /** Zeitpunkt der Anlage als ISO-Zeitstempel. */
  createdAt?: string
  /** Letzter echter Rezepteintrag im Plan; Reste zählen nicht. */
  lastPlannedOn?: IsoDate
}

export const RECIPE_COURSES = [
  'Hauptgericht',
  'Beilage',
  'Suppe',
  'Salat',
  'Vorspeise',
  'Dessert',
  'Frühstück',
  'Snack',
  'Gebäck',
  'Getränk',
  'Sauce & Dip',
] as const

export type RecipeCourse = (typeof RECIPE_COURSES)[number]

/** Teiländerung der Einordnung; null beziehungsweise eine leere Liste entfernt die Angabe. */
export interface RecipeOrganizationPatch {
  course?: RecipeCourse | null
  cuisine?: string | null
  tags?: string[]
  rating?: number | null
  toTry?: boolean
  notes?: string | null
  totalMinutes?: number | null
}

export interface TagSummary {
  name: string
  count: number
}

/** Von Hand bearbeitbare Angaben eines Rezepts. Zutaten sind Zeilen als Text; das Backend zerlegt sie. */
export interface RecipeInput {
  title: string
  servings: number | null
  ingredients: string[]
  instructions: string[]
}

/** Lokales Kalenderdatum, z. B. "2026-09-28". */
export type IsoDate = string

/** ISO-8601-Kalenderwoche, z. B. "2026-W40". */
export type IsoWeek = string

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** Mahlzeiten in der Reihenfolge, in der sie angezeigt werden. */
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

export type EntryKind = 'recipe' | 'note' | 'item' | 'leftover'

/** Ein Eintrag im Wochenplan: Rezept, Notiz, Einzelzutat oder Reste eines Rezepts. */
export interface PlanEntry {
  id: string
  meal: Meal
  position: number
  kind: EntryKind
  /** Bei Rezepten und Resten */
  recipeId?: string
  /** Portionen eines Rezepteintrags */
  servings?: number
  /** Bei Notizen und Einzelzutaten */
  text?: string
  /** Bei Resten: der Rezepteintrag, von dem sie stammen */
  leftoverOf?: { id: string; date: IsoDate } | { id: string; day: number }
}

export interface WeekPlan {
  week: IsoWeek
  /** Alle sieben Tage der Woche mit ihren Einträgen, nach Mahlzeit und Position sortiert. */
  days: Record<IsoDate, PlanEntry[]>
}

export type NewEntry =
  | { date: IsoDate; meal: Meal; kind: 'recipe'; recipeId: string; servings?: number }
  | { date: IsoDate; meal: Meal; kind: 'note' | 'item'; text: string }
  | { date: IsoDate; meal: Meal; kind: 'leftover'; leftoverOf: string }

export interface EntryPatch {
  date?: IsoDate
  meal?: Meal
  servings?: number | null
  text?: string
}

export type CopyMode = 'append' | 'replace'

export type EntryTarget = { kind: 'plan'; date: IsoDate } | { kind: 'menu'; menuId: string; day: number }

export interface MenuSummary {
  id: string
  name: string
  description?: string
  days: number
  /** Zahl der Einträge der Art recipe; Reste zählen nicht mit. */
  recipeCount: number
}

export interface MenuEntry extends Omit<PlanEntry, 'leftoverOf'> {
  day: number
  leftoverOf?: { id: string; day: number }
}

export interface Menu extends Omit<MenuSummary, 'recipeCount'> {
  createdAt: string
  entries: Record<number, MenuEntry[]>
}

export interface MenuInput {
  name: string
  description?: string
  days?: number
  from?: IsoDate
  to?: IsoDate
}

export type NewMenuEntry =
  | { day: number; meal: Meal; kind: 'recipe'; recipeId: string; servings?: number }
  | { day: number; meal: Meal; kind: 'note' | 'item'; text: string }
  | { day: number; meal: Meal; kind: 'leftover'; leftoverOf: string }

export interface MenuEntryPatch {
  day?: number
  meal?: Meal
  servings?: number | null
  text?: string
}

export interface ApplyMenuResult {
  weeks: WeekPlan[]
  skipped: string[]
}

export interface HouseholdSettings {
  visibleMeals: Meal[]
}

/** Ein Gang im Laden. „Sonstiges“ ist nicht löschbar. */
export interface ShoppingCategory {
  id: string
  name: string
  removable: boolean
}

export interface ShoppingStore {
  id: string
  name: string
}

/** Herkunft eines Anteils: aus dem Plan, von Hand oder aus dem Vorrat. */
export interface ShoppingSource {
  kind: 'plan' | 'manual' | 'staple'
  recipeId?: string
  recipeTitle?: string
  date?: IsoDate
  /** Menge dieses Anteils, etwa „333 g“ */
  amount?: string
  text?: string
}

export interface ShoppingItem {
  id: string
  name: string
  categoryId: string
  storeId?: string
  checked: boolean
  /** Fertig formatierte Menge, etwa „250 g + 2 EL“; fehlt bei Artikeln ohne Menge. */
  display?: string
  amounts: { quantity: number; unit?: string }[]
  sources: ShoppingSource[]
}

export interface ShoppingList {
  /** Steigt mit jeder Änderung; dient dem Abgleich beim Abfragen. */
  version: number
  categories: ShoppingCategory[]
  stores: ShoppingStore[]
  /** Nach Kategorie, offen vor erledigt und Namen sortiert. */
  items: ShoppingItem[]
}

export interface ShoppingItemPatch {
  name?: string
  /** Menge als Text, etwa „500 g“; leer = ohne Menge. Ersetzt die Herkunft. */
  quantity?: string
  categoryId?: string
  storeId?: string | null
}

export interface ShoppingImportResult {
  list: ShoppingList
  withoutIngredients: { id: string; title: string }[]
}

export interface ShoppingAlias {
  fromKey: string
  fromName: string
  toName: string
}

export interface Staple {
  id: string
  text: string
}
