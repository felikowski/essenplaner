import { useState, type FormEvent } from 'react'
import { formatShortDate, isValidDate } from '../lib/isoWeek'
import { MEAL_LABELS } from '../lib/meals'
import { MEALS, type IsoDate, type Meal } from '../types'
import { Modal } from './Modal'

interface Props {
  title: string
  confirmLabel: string
  /** Tage für die Schnellauswahl, meist die angezeigte Woche */
  days: IsoDate[]
  initialDate: IsoDate
  initialMeal: Meal
  onConfirm: (date: IsoDate, meal: Meal) => void
  onClose: () => void
}

/** Wählt Tag und Mahlzeit, etwa zum Verschieben oder für Reste. Jedes Datum ist möglich. */
export function TargetDialog({ title, confirmLabel, days, initialDate, initialMeal, onConfirm, onClose }: Props) {
  const [date, setDate] = useState(initialDate)
  const [meal, setMeal] = useState(initialMeal)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (isValidDate(date)) onConfirm(date, meal)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <span className="form__label" id="target-days">
          Tag
        </span>
        <div className="day-chips" role="group" aria-labelledby="target-days">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              className="chip"
              aria-pressed={day === date}
              onClick={() => setDate(day)}
            >
              {formatShortDate(day)}
            </button>
          ))}
        </div>
        <label className="form__label" htmlFor="target-date">
          Anderes Datum
        </label>
        <input
          id="target-date"
          className="input"
          type="date"
          value={date}
          required
          onChange={(event) => setDate(event.target.value)}
        />
        <label className="form__label" htmlFor="target-meal">
          Mahlzeit
        </label>
        <select
          id="target-meal"
          className="select"
          value={meal}
          onChange={(event) => setMeal(event.target.value as Meal)}
        >
          {MEALS.map((option) => (
            <option key={option} value={option}>
              {MEAL_LABELS[option]}
            </option>
          ))}
        </select>
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="button" disabled={!isValidDate(date)}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
