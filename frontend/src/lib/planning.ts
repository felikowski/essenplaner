import { formatShortDate } from './isoWeek'
import { MEAL_LABELS } from './meals'
import { MEALS, type IsoDate, type Meal } from '../types'

/** Hinweis nach dem Einplanen, z. B. „Für Mi 21.10. · Abendessen eingeplant“. */
export function plannedNotice(date: IsoDate, meal: Meal): string {
  return `Für ${formatShortDate(date)} · ${MEAL_LABELS[meal]} eingeplant`
}

/** Vorbelegte Mahlzeit beim Einplanen: Abendessen, sonst die erste sichtbare Mahlzeit. */
export function defaultMeal(visibleMeals: Meal[]): Meal {
  if (visibleMeals.includes('dinner')) return 'dinner'
  return MEALS.find((meal) => visibleMeals.includes(meal)) ?? 'dinner'
}
