import { useState } from 'react'
import { filterByTitle, sortByTitle, sourceLabel } from '../lib/recipes'
import type { Recipe } from '../types'
import { SearchField } from './SearchField'

interface Props {
  recipes: Recipe[]
  onSelect: (recipeId: string) => void
}

/** Suchbare Liste von Rezepten zum Auswählen. */
export function RecipeChooser({ recipes, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const visible = filterByTitle(sortByTitle(recipes), query)

  return (
    <>
      <SearchField value={query} onChange={setQuery} />
      {visible.length === 0 ? (
        <p className="status">Keine Rezepte gefunden</p>
      ) : (
        <ul className="picker-list">
          {visible.map((recipe) => (
            <li key={recipe.id}>
              <button type="button" className="picker-list__item" onClick={() => onSelect(recipe.id)}>
                <span>{recipe.title}</span>
                <span className="source-label">{sourceLabel(recipe)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
