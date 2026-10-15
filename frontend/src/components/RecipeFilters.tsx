import { useState } from 'react'
import { activeFilterCount, emptyRecipeFilters, type RecipeQueryState } from '../lib/recipeQuery'
import { RECIPE_COURSES } from '../types'
import { Modal } from './Modal'

interface Props {
  state: RecipeQueryState
  tags: string[]
  onChange: (state: RecipeQueryState) => void
}

/** Kompakte Filtersteuerung; am Handy öffnet sie sich als bestehendes Bottom-Sheet-Modal. */
export function RecipeFilters({ state, tags, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(state.filters)
  const setFilters = (filters: RecipeQueryState['filters']) => onChange({ ...state, filters })

  function removeTag(tag: string) {
    setFilters({ ...state.filters, tags: state.filters.tags.filter((candidate) => candidate !== tag) })
  }

  return (
    <div className="recipe-filters">
      <div className="recipe-filters__controls">
        <button type="button" className="button button--secondary" onClick={() => setOpen(true)}>
          Filter{count ? ` (${count})` : ''}
        </button>
        <label className="recipe-sort">
          <span>Sortierung</span>
          <select className="select" value={state.sort} onChange={(event) => onChange({ ...state, sort: event.target.value as RecipeQueryState['sort'] })}>
            <option value="title">Titel</option>
            <option value="rating">Bewertung</option>
            <option value="lastPlanned">Zuletzt geplant</option>
            <option value="created">Zuletzt hinzugefügt</option>
          </select>
        </label>
      </div>
      {count > 0 && (
        <div className="filter-chips" aria-label="Aktive Filter">
          {state.filters.course && <FilterChip label={state.filters.course} onRemove={() => setFilters({ ...state.filters, course: undefined })} />}
          {state.filters.tags.map((tag) => <FilterChip key={tag} label={tag} onRemove={() => removeTag(tag)} />)}
          {state.filters.minRating !== undefined && <FilterChip label={`ab ${state.filters.minRating} Sterne`} onRemove={() => setFilters({ ...state.filters, minRating: undefined })} />}
          {state.filters.toTry && <FilterChip label="Ausprobieren" onRemove={() => setFilters({ ...state.filters, toTry: false })} />}
          {state.filters.source && <FilterChip label={`Quelle: ${sourceLabel(state.filters.source)}`} onRemove={() => setFilters({ ...state.filters, source: undefined })} />}
          {state.filters.maxMinutes !== undefined && <FilterChip label={`bis ${state.filters.maxMinutes} Minuten`} onRemove={() => setFilters({ ...state.filters, maxMinutes: undefined })} />}
        </div>
      )}
      {open && (
        <Modal title="Rezepte filtern" onClose={() => setOpen(false)}>
          <div className="filter-form">
            <label className="form__label" htmlFor="filter-course">Gang</label>
            <select id="filter-course" className="select" value={state.filters.course ?? ''} onChange={(event) => setFilters({ ...state.filters, course: (event.target.value || undefined) as RecipeQueryState['filters']['course'] })}>
              <option value="">Alle Gänge</option>
              {RECIPE_COURSES.map((course) => <option key={course}>{course}</option>)}
            </select>

            <fieldset className="form__fieldset">
              <legend className="form__label">Tags</legend>
              {tags.length === 0 ? <p className="form__hint">Noch keine Tags vorhanden.</p> : tags.map((tag) => (
                <label key={tag} className="checkbox">
                  <input type="checkbox" checked={state.filters.tags.includes(tag)} onChange={(event) => setFilters({ ...state.filters, tags: event.target.checked ? [...state.filters.tags, tag] : state.filters.tags.filter((candidate) => candidate !== tag) })} />
                  {tag}
                </label>
              ))}
            </fieldset>

            <label className="form__label" htmlFor="filter-rating">Mindestbewertung</label>
            <select id="filter-rating" className="select" value={state.filters.minRating ?? ''} onChange={(event) => setFilters({ ...state.filters, minRating: event.target.value ? Number(event.target.value) : undefined })}>
              <option value="">Alle Bewertungen</option>
              {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>ab {rating} Sterne</option>)}
            </select>

            <label className="checkbox">
              <input type="checkbox" checked={state.filters.toTry} onChange={(event) => setFilters({ ...state.filters, toTry: event.target.checked })} />
              Nur „Ausprobieren“
            </label>

            <label className="form__label" htmlFor="filter-source">Quelle</label>
            <select id="filter-source" className="select" value={state.filters.source ?? ''} onChange={(event) => setFilters({ ...state.filters, source: (event.target.value || undefined) as RecipeQueryState['filters']['source'] })}>
              <option value="">Alle Quellen</option>
              <option value="pdf">PDF</option>
              <option value="web">Webseite</option>
              <option value="manual">Eigenes Rezept</option>
            </select>

            <label className="form__label" htmlFor="filter-time">Maximale Zeit in Minuten</label>
            <input id="filter-time" className="input input--short" type="number" min={1} max={1440} value={state.filters.maxMinutes ?? ''} onChange={(event) => setFilters({ ...state.filters, maxMinutes: event.target.value ? Number(event.target.value) : undefined })} />
          </div>
          <div className="modal__actions">
            <button type="button" className="button button--secondary" onClick={() => setFilters(emptyRecipeFilters())}>Filter zurücksetzen</button>
            <button type="button" className="button" onClick={() => setOpen(false)}>Fertig</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button type="button" className="filter-chip" onClick={onRemove} aria-label={`Filter ${label} entfernen`}>{label} ×</button>
}

function sourceLabel(source: 'pdf' | 'web' | 'manual') {
  return source === 'pdf' ? 'PDF' : source === 'web' ? 'Webseite' : 'Eigenes Rezept'
}
