import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { usePlannerApi } from '../api/context'
import {
  currentWeek,
  daysOfWeek,
  formatShortDate,
  formatWeekLabel,
  isValidDate,
  nextWeek,
  parseIsoDate,
  previousWeek,
  toIsoDate,
  weekOf,
} from '../lib/isoWeek'
import { MEAL_LABELS } from '../lib/meals'
import { defaultMeal, plannedNotice } from '../lib/planning'
import { useSettings } from '../lib/settingsContext'
import { MEALS, type IsoDate, type Meal, type Recipe } from '../types'
import { Modal } from './Modal'
import { ServingsPicker } from './ServingsPicker'

interface Props {
  recipe: Recipe
  /** Vorbelegte Portionen, etwa die in der Detailansicht gewählten. Standard: die des Rezepts. */
  initialServings?: number
  onPlanned: (date: IsoDate, meal: Meal) => void
  onClose: () => void
}

/** Plant ein Rezept an einem frei wählbaren Tag ein. Startet in der aktuellen Woche mit heute. */
export function PlanRecipeDialog({ recipe, initialServings, onPlanned, onClose }: Props) {
  const api = usePlannerApi()
  const { settings } = useSettings()
  const meals = MEALS.filter((meal) => settings.visibleMeals.includes(meal))
  const [now] = useState(() => new Date())
  const [week, setWeek] = useState(() => currentWeek(now))
  const [date, setDate] = useState<string>(() => toIsoDate(now))
  const [meal, setMeal] = useState<Meal>(() => defaultMeal(settings.visibleMeals))
  const [servings, setServings] = useState(initialServings ?? recipe.servings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function changeDate(value: string) {
    setDate(value)
    if (isValidDate(value)) setWeek(weekOf(parseIsoDate(value)))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!isValidDate(date) || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.createEntry({ date, meal, kind: 'recipe', recipeId: recipe.id, ...(servings !== undefined && { servings }) })
      onPlanned(date, meal)
    } catch {
      setError('Das Rezept konnte nicht eingeplant werden. Bitte versuche es noch einmal.')
      setBusy(false)
    }
  }

  return (
    <Modal title={`Einplanen: ${recipe.title}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <span className="form__label" id="plan-days">
          Tag
        </span>
        <div className="plan-week">
          <button type="button" className="icon-button" aria-label="Vorige Woche" onClick={() => setWeek(previousWeek(week))}>
            ‹
          </button>
          <span className="plan-week__label">{formatWeekLabel(week)}</span>
          <button type="button" className="icon-button" aria-label="Nächste Woche" onClick={() => setWeek(nextWeek(week))}>
            ›
          </button>
        </div>
        <div className="day-chips" role="group" aria-labelledby="plan-days">
          {daysOfWeek(week).map((day) => (
            <button key={day} type="button" className="chip" aria-pressed={day === date} onClick={() => setDate(day)}>
              {formatShortDate(day)}
            </button>
          ))}
        </div>
        <label className="form__label" htmlFor="plan-date">
          Anderes Datum
        </label>
        <input
          id="plan-date"
          className="input"
          type="date"
          value={date}
          required
          onChange={(event) => changeDate(event.target.value)}
        />
        {meals.length > 1 && (
          <>
            <label className="form__label" htmlFor="plan-meal">
              Mahlzeit
            </label>
            <select id="plan-meal" className="select" value={meal} onChange={(event) => setMeal(event.target.value as Meal)}>
              {meals.map((option) => (
                <option key={option} value={option}>
                  {MEAL_LABELS[option]}
                </option>
              ))}
            </select>
          </>
        )}
        {servings !== undefined && recipe.servings !== undefined && (
          <>
            <span className="form__label">Portionen</span>
            <ServingsPicker servings={servings} recipeServings={recipe.servings} onChange={setServings} />
          </>
        )}
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="button" disabled={busy || !isValidDate(date)}>
            {busy ? 'Wird eingeplant …' : 'Einplanen'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Rückmeldung nach dem Einplanen mit Link zur betreffenden Woche. */
export function PlannedNotice({ date, meal }: { date: IsoDate; meal: Meal }) {
  return (
    <p className="notice no-print planned-notice" role="status">
      {plannedNotice(date, meal)} · <Link to={`/woche/${weekOf(parseIsoDate(date))}`}>Zur Woche</Link>
    </p>
  )
}
