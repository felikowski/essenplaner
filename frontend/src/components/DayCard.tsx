import { Link } from 'react-router'
import { formatDayMonth, formatWeekday } from '../lib/isoWeek'
import type { IsoDate, Recipe } from '../types'

interface Props {
  date: IsoDate
  recipeId: string | null
  recipe: Recipe | undefined
  isToday: boolean
  saving: boolean
  onPick: () => void
}

export function DayCard({ date, recipeId, recipe, isToday, saving, onPick }: Props) {
  const weekday = formatWeekday(date)

  return (
    <li className={isToday ? 'day-card day-card--today' : 'day-card'} aria-current={isToday ? 'date' : undefined}>
      <div className="day-card__head">
        <h2 className="day-card__weekday">{weekday}</h2>
        <span className="day-card__date">{formatDayMonth(date)}</span>
        {isToday && <span className="badge">Heute</span>}
      </div>
      <div className="day-card__body">
        {recipeId ? (
          <Link to={`/rezepte/${recipeId}`} className="day-card__recipe">
            {recipe?.title ?? 'Unbekanntes Rezept'}
          </Link>
        ) : (
          <p className="day-card__empty">Noch nichts geplant</p>
        )}
        <button
          type="button"
          className="button button--small"
          onClick={onPick}
          disabled={saving}
          aria-label={`${weekday}: Rezept ${recipeId ? 'ändern' : 'auswählen'}`}
        >
          {saving ? 'Speichert …' : recipeId ? 'Ändern' : 'Auswählen'}
        </button>
      </div>
    </li>
  )
}
