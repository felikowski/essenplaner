import { useState, type FormEvent } from 'react'
import { formatShortDate, isValidDate } from '../lib/isoWeek'
import { MEAL_LABELS } from '../lib/meals'
import { MEALS, type EntryTarget, type Meal } from '../types'
import { Modal } from './Modal'

interface Props {
  title: string
  confirmLabel: string
  targets: EntryTarget[]
  initialTarget: EntryTarget
  initialMeal: Meal
  onConfirm: (target: EntryTarget, meal: Meal) => void
  onClose: () => void
}

/** Wählt Tag und Mahlzeit, etwa zum Verschieben oder für Reste. Jedes Datum ist möglich. */
export function TargetDialog({ title, confirmLabel, targets, initialTarget, initialMeal, onConfirm, onClose }: Props) {
  const [target, setTarget] = useState(initialTarget)
  const [meal, setMeal] = useState(initialMeal)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (target.kind === 'menu' || isValidDate(target.date)) onConfirm(target, meal)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <span className="form__label" id="target-days">
          {target.kind === 'plan' ? 'Tag' : 'Menütag'}
        </span>
        <div className="day-chips" role="group" aria-labelledby="target-days">
          {targets.map((option) => (
            <button
              key={targetKey(option)}
              type="button"
              className="chip"
              aria-pressed={targetKey(option) === targetKey(target)}
              onClick={() => setTarget(option)}
            >
              {option.kind === 'plan' ? formatShortDate(option.date) : `Tag ${option.day}`}
            </button>
          ))}
        </div>
        {target.kind === 'plan' && (
          <>
            <label className="form__label" htmlFor="target-date">
              Anderes Datum
            </label>
            <input
              id="target-date"
              className="input"
              type="date"
              value={target.date}
              required
              onChange={(event) => setTarget({ kind: 'plan', date: event.target.value })}
            />
          </>
        )}
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
          <button type="submit" className="button" disabled={target.kind === 'plan' && !isValidDate(target.date)}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function targetKey(target: EntryTarget): string {
  return target.kind === 'plan' ? `plan-${target.date}` : `menu-${target.menuId}-${target.day}`
}
