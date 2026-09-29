export type RecipeSource =
  | { kind: 'pdf'; pdfUrl: string }
  | { kind: 'web'; url: string }

export interface Recipe {
  id: string
  title: string
  source: RecipeSource
  imageUrl?: string
  servings?: string
  ingredients?: string[]
  instructions?: string[]
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
