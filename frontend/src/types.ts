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

export interface WeekPlan {
  week: IsoWeek
  /** Alle sieben Tage der Woche, Wert ist die Rezept-ID oder null. */
  days: Record<IsoDate, string | null>
}
