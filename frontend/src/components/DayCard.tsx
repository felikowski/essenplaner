import { Link } from 'react-router'
import { formatDayMonth, formatShortDate, formatWeekday } from '../lib/isoWeek'
import { MEAL_LABELS } from '../lib/meals'
import { formatServings } from '../lib/recipes'
import { entryTitle } from '../lib/entries'
import type { IsoDate, Meal, PlanEntry, Recipe } from '../types'

interface Props {
  date: IsoDate
  entries: PlanEntry[]
  visibleMeals: Meal[]
  recipes: Recipe[]
  isToday: boolean
  busy: boolean
  onAdd: (meal: Meal) => void
  onOpenEntry: (entry: PlanEntry) => void
}

export function DayCard({ date, entries, visibleMeals, recipes, isToday, busy, onAdd, onOpenEntry }: Props) {
  const weekday = formatWeekday(date)
  const showMealHeadings = visibleMeals.length > 1
  const visibleEntries = entries.filter((entry) => visibleMeals.includes(entry.meal))

  return (
    <li className={isToday ? 'day-card day-card--today' : 'day-card'} aria-current={isToday ? 'date' : undefined}>
      <div className="day-card__head">
        <h2 className="day-card__weekday">{weekday}</h2>
        <span className="day-card__date">{formatDayMonth(date)}</span>
        {isToday && <span className="badge">Heute</span>}
      </div>
      {visibleEntries.length === 0 && !showMealHeadings && <p className="day-card__empty">Noch nichts geplant</p>}
      {visibleMeals.map((meal) => {
        const mealEntries = entries.filter((entry) => entry.meal === meal)
        return (
          <section key={meal} className="meal" aria-label={showMealHeadings ? `${weekday} ${MEAL_LABELS[meal]}` : undefined}>
            {showMealHeadings && <h3 className="meal__title">{MEAL_LABELS[meal]}</h3>}
            {mealEntries.length > 0 && (
              <ul className="meal__entries">
                {mealEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    recipe={recipes.find((recipe) => recipe.id === entry.recipeId)}
                    busy={busy}
                    onOpen={() => onOpenEntry(entry)}
                  />
                ))}
              </ul>
            )}
            <button
              type="button"
              className="add-button"
              onClick={() => onAdd(meal)}
              disabled={busy}
              aria-label={`${weekday} ${MEAL_LABELS[meal]}: hinzufügen`}
            >
              + Hinzufügen
            </button>
          </section>
        )
      })}
    </li>
  )
}

interface EntryRowProps {
  entry: PlanEntry
  recipe: Recipe | undefined
  busy: boolean
  onOpen: () => void
}

function EntryRow({ entry, recipe, busy, onOpen }: EntryRowProps) {
  const title = entryTitle(entry, recipe)
  return (
    <li className="entry">
      <div className="entry__main">
        <EntryContent entry={entry} recipe={recipe} />
      </div>
      <button
        type="button"
        className="icon-button icon-button--quiet"
        onClick={onOpen}
        disabled={busy}
        aria-label={`${title}: Optionen`}
      >
        ⋯
      </button>
    </li>
  )
}

function EntryContent({ entry, recipe }: { entry: PlanEntry; recipe: Recipe | undefined }) {
  const recipeLink = entry.recipeId ? (
    <Link to={recipeLinkTarget(entry)} className="entry__recipe">
      {recipe?.title ?? 'Unbekanntes Rezept'}
    </Link>
  ) : null
  const unavailable = recipe?.available === false && <span className="notice-label">Nicht mehr verfügbar</span>

  switch (entry.kind) {
    case 'recipe': {
      const differs = entry.servings !== undefined && entry.servings !== recipe?.servings
      return (
        <>
          {recipeLink}
          {differs && entry.servings !== undefined && <span className="entry__meta">{formatServings(entry.servings)}</span>}
          {unavailable}
        </>
      )
    }
    case 'leftover':
      return (
        <>
          <span className="entry__prefix">Reste:</span> {recipeLink}
          {entry.leftoverOf && <span className="entry__meta">(von {formatShortDate(entry.leftoverOf.date)})</span>}
          {unavailable}
        </>
      )
    case 'note':
      return <span className="entry__note">{entry.text}</span>
    case 'item':
      return (
        <>
          <span className="entry__prefix">Zutat:</span> <span>{entry.text}</span>
        </>
      )
  }
}

function recipeLinkTarget(entry: PlanEntry): string {
  return `/rezepte/${entry.recipeId}`
}
