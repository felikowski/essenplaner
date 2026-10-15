import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { ImportRecipeDialog } from '../components/ImportRecipeDialog'
import { SearchField } from '../components/SearchField'
import { LoadError, Loading } from '../components/Status'
import { RecipeImage } from '../components/RecipeImage'
import { RecipeFilters } from '../components/RecipeFilters'
import { activeFilterCount, queryRecipes, recipeQueryFromParams, recipeQueryToParams, type RecipeQueryState } from '../lib/recipeQuery'
import { sourceLabel } from '../lib/recipes'
import { useAsyncData } from '../lib/useAsyncData'
import type { Recipe } from '../types'

export function RecipeListPage() {
  const api = usePlannerApi()
  const load = useCallback(() => api.listRecipes(), [api])
  const { state, retry } = useAsyncData(load)
  // Der Suchbegriff steht in der URL, damit er beim Zurückkehren aus dem Detail erhalten bleibt.
  const [searchParams, setSearchParams] = useSearchParams()
  const queryState = recipeQueryFromParams(searchParams)
  const [importing, setImporting] = useState(false)
  const navigate = useNavigate()

  function setQueryState(value: RecipeQueryState) {
    setSearchParams(recipeQueryToParams(value), { replace: true })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Rezepte</h1>
        <div className="page-header__actions">
          <Link className="button button--secondary" to="/rezepte/neu">
            Neues Rezept
          </Link>
          <button type="button" className="button" onClick={() => setImporting(true)}>
            Rezept hinzufügen
          </button>
        </div>
      </div>
      <div className="recipe-list__links">
        <Link to="/rezepte/zutaten">Was habe ich da?</Link>
        <button type="button" className="link-button" onClick={() => setQueryState({ ...queryState, filters: { ...queryState.filters, toTry: true } })}>Ausprobieren</button>
      </div>
      {importing && (
        <ImportRecipeDialog
          onImported={(recipe) => navigate(`/rezepte/${recipe.id}`)}
          onClose={() => setImporting(false)}
        />
      )}
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError message="Die Rezepte konnten nicht geladen werden." onRetry={retry} />}
      {state.status === 'ready' &&
        (state.data.length === 0 ? (
          <p className="status">
            Noch keine Rezepte vorhanden. Lege über „Neues Rezept“ ein eigenes an oder übernimm eines per Link mit
            „Rezept hinzufügen“.
          </p>
        ) : (
          <>
            <SearchField value={queryState.query} onChange={(query) => setQueryState({ ...queryState, query })} />
            <RecipeFilters state={queryState} tags={allTags(state.data)} onChange={setQueryState} />
            <RecipeList
              recipes={queryRecipes(state.data, queryState)}
              filtered={activeFilterCount(queryState.filters) > 0}
              onReset={() => setQueryState({ ...queryState, filters: { tags: [], toTry: false } })}
            />
          </>
        ))}
    </div>
  )
}

function RecipeList({ recipes, filtered, onReset }: { recipes: Recipe[]; filtered: boolean; onReset: () => void }) {
  if (recipes.length === 0) return filtered ? (
    <div className="status"><p>Keine Rezepte passen zu den Filtern</p><button type="button" className="button button--secondary" onClick={onReset}>Filter zurücksetzen</button></div>
  ) : <p className="status">Keine Rezepte gefunden</p>

  return (
    <ul className="recipe-list">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <Link to={`/rezepte/${recipe.id}`} className="recipe-card">
            <RecipeImage
              className="recipe-card__image"
              src={recipe.imageUrl}
              alt=""
              loading="lazy"
              fallback={<span className="recipe-card__image recipe-card__image--empty" aria-hidden="true" />}
            />
            <span className="recipe-card__text">
              <span className="recipe-card__title">{recipe.title}</span>
              <span className="recipe-card__meta">
                <span className="source-label">{sourceLabel(recipe)}</span>
                {recipe.rating !== undefined && <span aria-label={`${recipe.rating} von 5 Sternen`}>{'★'.repeat(recipe.rating)}{'☆'.repeat(5 - recipe.rating)}</span>}
                {recipe.totalMinutes !== undefined && <span>{recipe.totalMinutes} Min.</span>}
              </span>
              {recipe.tags && <span className="recipe-card__tags">{recipe.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function allTags(recipes: Recipe[]) {
  return [...new Set(recipes.flatMap((recipe) => recipe.tags ?? []))].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
}
