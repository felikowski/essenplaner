import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { PlanRecipeDialog, PlannedNotice } from '../components/PlanRecipeDialog'
import { RecipeHistory } from '../components/RecipeHistory'
import { RecipeImage } from '../components/RecipeImage'
import { ServingsPicker } from '../components/ServingsPicker'
import { LoadError, Loading } from '../components/Status'
import { SubstitutionHint } from '../components/SubstitutionHint'
import { recipeShareText } from '../lib/recipeShare'
import { formatServings, sourceLabel } from '../lib/recipes'
import { scaleIngredient } from '../lib/scale'
import { resolveStepAmounts } from '../lib/stepAmounts'
import { useAsyncData } from '../lib/useAsyncData'
import { useServingsParam } from '../lib/useServingsParam'
import type { IsoDate, Meal, Recipe, RecipeOrganizationPatch } from '../types'

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

function RecipeDetail({ recipe: initialRecipe }: { recipe: Recipe }) {
  const api = usePlannerApi()
  const location = useLocation()
  const [recipe, setRecipe] = useState(initialRecipe)
  const [organizationError, setOrganizationError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [planning, setPlanning] = useState(false)
  const [planned, setPlanned] = useState<{ date: IsoDate; meal: Meal } | null>(null)
  const [plannedCount, setPlannedCount] = useState(0)
  const { source } = recipe
  const unavailable = recipe.available === false
  const hasIngredients = (recipe.ingredients?.length ?? 0) > 0
  const hasInstructions = (recipe.instructions?.length ?? 0) > 0
  const [servings, setServings] = useServingsParam(recipe.servings)
  const factor = servings !== undefined && recipe.servings !== undefined ? servings / recipe.servings : 1
  const askHowItWas = recipe.toTry && recipe.lastPlannedOn !== undefined && recipe.lastPlannedOn < localToday()

  async function updateOrganization(patch: RecipeOrganizationPatch) {
    setOrganizationError(null)
    try {
      setRecipe(await api.updateRecipeOrganization(recipe.id, patch))
    } catch {
      setOrganizationError('Die Einordnung konnte nicht gespeichert werden.')
    }
  }

  async function shareRecipe() {
    setActionNotice(null)
    setActionError(null)
    const text = recipeShareText(recipe, servings)
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: recipe.title, text })
      } catch {
        // Das Teilen-Menü wurde geschlossen.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setActionNotice('Das Rezept wurde in die Zwischenablage kopiert.')
    } catch {
      setActionError('Das Rezept konnte nicht kopiert werden.')
    }
  }

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
      <section className="recipe-organization" aria-label="Einordnung">
        <div className="recipe-organization__heading">
          <h2>Einordnung</h2>
          <label className="checkbox">
            <input type="checkbox" checked={recipe.toTry === true} onChange={(event) => void updateOrganization({ toTry: event.target.checked })} />
            Ausprobieren
          </label>
        </div>
        <StarRating value={recipe.rating} onRate={(rating) => void updateOrganization({ rating })} />
        {(recipe.course || recipe.cuisine || recipe.totalMinutes !== undefined) && (
          <p className="recipe-organization__facts">
            {[recipe.course, recipe.cuisine, recipe.totalMinutes !== undefined ? `${recipe.totalMinutes} Min.` : ''].filter(Boolean).join(' · ')}
          </p>
        )}
        {recipe.tags && <div className="recipe-card__tags">{recipe.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
        {recipe.notes && <p className="recipe-notes"><strong>Notiz:</strong> {recipe.notes}</p>}
        {organizationError && <p className="form__error" role="alert">{organizationError}</p>}
      </section>
      {askHowItWas && (
        <section className="how-was-it" aria-labelledby="how-was-it-title">
          <h2 id="how-was-it-title">Wie war’s?</h2>
          <p>Bewerte das Rezept. Danach verschwindet es aus „Ausprobieren“.</p>
          <StarRating value={recipe.rating} onRate={(rating) => void updateOrganization({ rating, toTry: false })} label="Nach dem Kochen bewerten" />
        </section>
      )}
      {/* Nach dem Einplanen neu laden, damit der Verlauf den neuen Eintrag zeigt. */}
      <RecipeHistory key={plannedCount} recipeId={recipe.id} />
      <div className="recipe-detail__actions no-print">
        {(hasIngredients || hasInstructions) && (
          <Link className="button" to={`/rezepte/${recipe.id}/kochen${location.search}`}>
            Kochen
          </Link>
        )}
        {!unavailable && (
          <button type="button" className="button button--secondary" onClick={() => setPlanning(true)}>
            Einplanen
          </button>
        )}
        <button type="button" className="button button--secondary" onClick={() => void shareRecipe()}>
          Teilen
        </button>
        <button type="button" className="button button--secondary" onClick={() => window.print()}>
          Drucken
        </button>
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
      {planned && <PlannedNotice date={planned.date} meal={planned.meal} />}
      {actionNotice && <p className="notice no-print" role="status">{actionNotice}</p>}
      {actionError && <p className="form__error no-print" role="alert">{actionError}</p>}
      {hasIngredients ? (
        <section className="recipe-detail__ingredients-section">
          <h2>{servings !== undefined ? `Zutaten für ${formatServings(servings)}` : 'Zutaten'}</h2>
          {servings !== undefined && recipe.servings !== undefined && (
            <ServingsPicker servings={servings} recipeServings={recipe.servings} onChange={setServings} />
          )}
          <ul className="recipe-detail__ingredients">
            {recipe.ingredients?.map((ingredient, index) => (
              <li key={index}>
                <span>{scaleIngredient(ingredient, factor)}</span>
                <SubstitutionHint ingredient={ingredient} factor={factor} />
              </li>
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
        <section className="recipe-detail__instructions-section">
          <h2>Zubereitung</h2>
          <ol className="recipe-detail__steps">
            {recipe.instructions.map((step, index) => (
              <li key={index}>
                <Step text={step} recipeServings={recipe.servings} servings={servings} />
              </li>
            ))}
          </ol>
        </section>
      )}
      {recipe.removable && <RemoveRecipe recipe={recipe} />}
      {planning && (
        <PlanRecipeDialog
          recipe={recipe}
          initialServings={servings}
          onPlanned={(date, meal) => {
            setPlanning(false)
            setPlanned({ date, meal })
            setPlannedCount((count) => count + 1)
          }}
          onClose={() => setPlanning(false)}
        />
      )}
    </article>
  )
}

function StarRating({ value, onRate, label = 'Bewertung' }: { value?: number; onRate: (rating: number) => void; label?: string }) {
  return (
    <div className="star-rating" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <button key={rating} type="button" className="star-rating__star" aria-label={`${rating} Sterne`} aria-pressed={value === rating} onClick={() => onRate(rating)}>
          {rating <= (value ?? 0) ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

function localToday() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Zubereitungsschritt mit aufgelösten Mengen-Varianten; umgerechnete Mengen sind kursiv. */
function Step({ text, recipeServings, servings }: { text: string; recipeServings?: number; servings?: number }) {
  return resolveStepAmounts(text, recipeServings, servings).map((part, index) =>
    part.kind === 'amount' && part.scaledFrom ? (
      <em key={index} className="scaled-amount" title={`umgerechnet aus ${part.scaledFrom}`}>
        {part.text}
      </em>
    ) : (
      part.text
    ),
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
