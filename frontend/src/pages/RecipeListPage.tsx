import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { SearchField } from '../components/SearchField'
import { LoadError, Loading } from '../components/Status'
import { filterByTitle, sortByTitle, sourceLabel } from '../lib/recipes'
import { useAsyncData } from '../lib/useAsyncData'

export function RecipeListPage() {
  const api = usePlannerApi()
  const load = useCallback(() => api.listRecipes().then(sortByTitle), [api])
  const { state, retry } = useAsyncData(load)
  // Der Suchbegriff steht in der URL, damit er beim Zurückkehren aus dem Detail erhalten bleibt.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''

  function setQuery(value: string) {
    setSearchParams(value ? { q: value } : {}, { replace: true })
  }

  return (
    <div className="page">
      <h1>Rezepte</h1>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError message="Die Rezepte konnten nicht geladen werden." onRetry={retry} />}
      {state.status === 'ready' &&
        (state.data.length === 0 ? (
          <p className="status">Noch keine Rezepte vorhanden.</p>
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} />
            <RecipeList recipes={filterByTitle(state.data, query)} />
          </>
        ))}
    </div>
  )
}

function RecipeList({ recipes }: { recipes: ReturnType<typeof sortByTitle> }) {
  if (recipes.length === 0) return <p className="status">Keine Rezepte gefunden</p>

  return (
    <ul className="recipe-list">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <Link to={`/rezepte/${recipe.id}`} className="recipe-card">
            {recipe.imageUrl ? (
              <img className="recipe-card__image" src={recipe.imageUrl} alt="" loading="lazy" />
            ) : (
              <span className="recipe-card__image recipe-card__image--empty" aria-hidden="true" />
            )}
            <span className="recipe-card__text">
              <span className="recipe-card__title">{recipe.title}</span>
              <span className="source-label">{sourceLabel(recipe)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
