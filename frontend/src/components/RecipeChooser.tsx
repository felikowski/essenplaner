import { useState } from 'react'
import { emptyRecipeFilters, queryRecipes, type RecipeQueryState } from '../lib/recipeQuery'
import { sourceLabel } from '../lib/recipes'
import type { Recipe } from '../types'
import { SearchField } from './SearchField'
import { RecipeFilters } from './RecipeFilters'

interface Props {
  recipes: Recipe[]
  onSelect: (recipeId: string) => void
}

/** Suchbare Liste von Rezepten zum Auswählen. */
export function RecipeChooser({ recipes, onSelect }: Props) {
  const [state, setState] = useState<RecipeQueryState>({ query: '', sort: 'title', filters: emptyRecipeFilters() })
  const visible = queryRecipes(recipes, state)
  const tags = [...new Set(recipes.flatMap((recipe) => recipe.tags ?? []))]

  return (
    <>
      <SearchField value={state.query} onChange={(query) => setState((current) => ({ ...current, query }))} />
      <RecipeFilters state={state} tags={tags} onChange={setState} />
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
