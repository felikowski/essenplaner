import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { LoadError, Loading } from '../components/Status'
import { useAsyncData } from '../lib/useAsyncData'
import type { Recipe } from '../types'

export function RecipeDetailPage() {
  const { id = '' } = useParams()
  const api = usePlannerApi()
  const load = useCallback(() => api.getRecipe(id), [api, id])
  const { state, retry } = useAsyncData(load)

  return (
    <div className="page">
      <p>
        <Link to="/rezepte">‹ Alle Rezepte</Link>
      </p>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError message="Das Rezept konnte nicht geladen werden." onRetry={retry} />}
      {state.status === 'ready' &&
        (state.data ? (
          <RecipeDetail recipe={state.data} />
        ) : (
          <>
            <h1>Rezept nicht gefunden</h1>
            <p>
              <Link to="/rezepte">Zur Rezeptliste</Link>
            </p>
          </>
        ))}
    </div>
  )
}

function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { source } = recipe

  return (
    <article className="recipe-detail">
      <h1>{recipe.title}</h1>
      {recipe.imageUrl && <img className="recipe-detail__image" src={recipe.imageUrl} alt={recipe.title} />}
      {recipe.servings && <p className="recipe-detail__servings">{recipe.servings}</p>}
      <p>
        <a
          className="button"
          href={source.kind === 'pdf' ? source.pdfUrl : source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {source.kind === 'pdf' ? 'PDF öffnen' : 'Original ansehen'}
        </a>
      </p>
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <section>
          <h2>Zutaten</h2>
          <ul className="recipe-detail__ingredients">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>{ingredient}</li>
            ))}
          </ul>
        </section>
      )}
      {recipe.instructions && recipe.instructions.length > 0 && (
        <section>
          <h2>Zubereitung</h2>
          <ol className="recipe-detail__steps">
            {recipe.instructions.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </section>
      )}
    </article>
  )
}
