import { useState } from 'react'
import { filterByTitle, sortByTitle, sourceLabel } from '../lib/recipes'
import type { Recipe } from '../types'
import { Modal } from './Modal'
import { SearchField } from './SearchField'

interface Props {
  recipes: Recipe[]
  dayLabel: string
  selectedId: string | null
  onSelect: (recipeId: string | null) => void
  onClose: () => void
}

export function RecipePicker({ recipes, dayLabel, selectedId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const visible = filterByTitle(sortByTitle(recipes), query)

  return (
    <Modal title={`Rezept für ${dayLabel}`} onClose={onClose}>
      <SearchField value={query} onChange={setQuery} />
      {visible.length === 0 ? (
        <p className="status">Keine Rezepte gefunden</p>
      ) : (
        <ul className="picker-list">
          {visible.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className="picker-list__item"
                aria-current={recipe.id === selectedId ? 'true' : undefined}
                onClick={() => onSelect(recipe.id)}
              >
                <span>{recipe.title}</span>
                <span className="source-label">{sourceLabel(recipe)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="modal__actions">
        {selectedId && (
          <button type="button" className="button button--secondary" onClick={() => onSelect(null)}>
            Kein Gericht
          </button>
        )}
        <button type="button" className="button button--secondary" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Modal>
  )
}
