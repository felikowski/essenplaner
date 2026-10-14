import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { RecipeHistory } from '../components/RecipeHistory'
import { RecipeImage } from '../components/RecipeImage'
import { LoadError, Loading } from '../components/Status'
import { formatServings, sourceLabel } from '../lib/recipes'
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
  const unavailable = recipe.available === false
  const hasIngredients = (recipe.ingredients?.length ?? 0) > 0

  return (
    <article className="recipe-detail">
      <h1>{recipe.title}</h1>
      {unavailable && (
        <p className="notice" role="note">
          Nicht mehr verfügbar. Das Rezept steht nur noch in bestehenden Plänen.
        </p>
      )}
      <RecipeImage className="recipe-detail__image" src={recipe.imageUrl} alt={recipe.title} />
      <p className="recipe-detail__meta">
        <span className="source-label">{sourceLabel(recipe)}</span>
        {recipe.servings !== undefined && <span>{formatServings(recipe.servings)}</span>}
      </p>
      <RecipeHistory recipeId={recipe.id} />
      <div className="recipe-detail__actions">
        {source.kind !== 'manual' && (
          <a
            className="button"
            href={source.kind === 'pdf' ? source.pdfUrl : source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {source.kind === 'pdf' ? 'PDF öffnen' : 'Original ansehen'}
          </a>
        )}
        {!unavailable && (
          <Link className="button button--secondary" to={`/rezepte/${recipe.id}/bearbeiten`}>
            Bearbeiten
          </Link>
        )}
      </div>
      {hasIngredients ? (
        <section>
          <h2>Zutaten</h2>
          <ul className="recipe-detail__ingredients">
            {recipe.ingredients?.map((ingredient, index) => (
              <li key={index}>{ingredient.text}</li>
            ))}
          </ul>
        </section>
      ) : (
        !unavailable && (
          <p className="notice">
            Für dieses Rezept sind noch keine Zutaten erfasst.{' '}
            <Link to={`/rezepte/${recipe.id}/bearbeiten`}>Zutaten nachtragen</Link>
          </p>
        )
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
      {recipe.removable && <RemoveRecipe recipe={recipe} />}
    </article>
  )
}

function RemoveRecipe({ recipe }: { recipe: Recipe }) {
  const api = usePlannerApi()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await api.removeRecipe(recipe.id)
      navigate('/rezepte')
    } catch {
      setError('Das Rezept konnte nicht entfernt werden. Bitte versuche es noch einmal.')
      setBusy(false)
    }
  }

  return (
    <section className="danger-zone">
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="danger-zone__confirm">
          <p>„{recipe.title}“ entfernen? In bereits geplanten Tagen bleibt es sichtbar.</p>
          <div className="modal__actions">
            <button type="button" className="button button--secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Abbrechen
            </button>
            <button type="button" className="button button--danger" onClick={remove} disabled={busy}>
              {busy ? 'Wird entfernt …' : 'Endgültig entfernen'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="button button--secondary" onClick={() => setConfirming(true)}>
          Rezept entfernen
        </button>
      )}
    </section>
  )
}
