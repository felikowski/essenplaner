import { useState, type FormEvent } from 'react'
import { formatServings } from '../lib/recipes'
import type { PlanEntry, Recipe } from '../types'
import { Modal } from './Modal'

interface Props {
  entry: PlanEntry
  title: string
  recipe: Recipe | undefined
  busy: boolean
  onSetServings: (servings: number | null) => void
  onMove: () => void
  onLeftover: () => void
  onDelete: () => void
  onClose: () => void
}

/** Aktionen für einen Planeintrag: Portionen, Verschieben, Reste einplanen, Entfernen. */
export function EntryActionsDialog({ entry, title, recipe, busy, onSetServings, onMove, onLeftover, onDelete, onClose }: Props) {
  const [servings, setServings] = useState(entry.servings !== undefined ? String(entry.servings) : '')
  const isRecipe = entry.kind === 'recipe'
  const parsed = /^\d+$/.test(servings.trim()) ? Number(servings) : null
  const servingsValid = servings.trim() === '' || (parsed !== null && parsed >= 1 && parsed <= 99)

  function submitServings(event: FormEvent) {
    event.preventDefault()
    if (servingsValid) onSetServings(servings.trim() === '' ? null : parsed)
  }

  return (
    <Modal title={title} onClose={onClose}>
      {isRecipe && (
        <form className="form servings-form" onSubmit={submitServings}>
          <label className="form__label" htmlFor="entry-servings">
            Portionen
          </label>
          <div className="servings-form__row">
            <input
              id="entry-servings"
              className="input input--short"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={servings}
              aria-invalid={!servingsValid || undefined}
              onChange={(event) => setServings(event.target.value)}
            />
            <button type="submit" className="button button--secondary" disabled={busy || !servingsValid}>
              Übernehmen
            </button>
          </div>
          {recipe?.servings !== undefined && (
            <p className="form__hint">Das Rezept ist für {formatServings(recipe.servings)}.</p>
          )}
        </form>
      )}
      <div className="action-list">
        <button type="button" className="button button--secondary" onClick={onMove} disabled={busy}>
          Verschieben
        </button>
        {isRecipe && (
          <button type="button" className="button button--secondary" onClick={onLeftover} disabled={busy}>
            Reste einplanen
          </button>
        )}
        <button type="button" className="button button--danger" onClick={onDelete} disabled={busy}>
          Entfernen
        </button>
      </div>
      <div className="modal__actions">
        <button type="button" className="button button--secondary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </Modal>
  )
}
