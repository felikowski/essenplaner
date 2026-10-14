import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { RequestError } from '../api/request'
import { IngredientListEditor } from '../components/IngredientListEditor'
import { Modal } from '../components/Modal'
import { LoadError, Loading } from '../components/Status'
import { useAsyncData } from '../lib/useAsyncData'
import type { Recipe, RecipeInput } from '../types'

/** /rezepte/neu legt ein eigenes Rezept an, /rezepte/:id/bearbeiten bearbeitet ein vorhandenes. */
export function RecipeEditPage() {
  const { id } = useParams()
  const api = usePlannerApi()
  const load = useCallback(() => (id ? api.getRecipe(id) : Promise.resolve(null)), [api, id])
  const { state, retry } = useAsyncData(load)

  if (!id) return <RecipeForm key="neu" recipe={null} />

  return (
    <div className="page">
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError message="Das Rezept konnte nicht geladen werden." onRetry={retry} />}
      {state.status === 'ready' &&
        (state.data && state.data.available !== false ? (
          <RecipeForm key={state.data.id} recipe={state.data} />
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

interface FormState {
  title: string
  servings: string
  ingredients: string[]
  instructions: string
}

function initialState(recipe: Recipe | null): FormState {
  return {
    title: recipe?.title ?? '',
    servings: recipe?.servings !== undefined ? String(recipe.servings) : '',
    ingredients: recipe?.ingredients?.map((ingredient) => ingredient.text) ?? [''],
    instructions: recipe?.instructions?.join('\n') ?? '',
  }
}

type Field = 'title' | 'servings' | 'ingredients' | 'instructions'

function RecipeForm({ recipe }: { recipe: Recipe | null }) {
  const api = usePlannerApi()
  const navigate = useNavigate()
  const [initial] = useState(() => initialState(recipe))
  const [form, setForm] = useState(initial)
  const [fieldError, setFieldError] = useState<{ field: Field; message: string } | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const isNew = recipe === null
  const titleEditable = isNew || recipe.titleEditable === true
  const dirty = JSON.stringify(normalize(form)) !== JSON.stringify(normalize(initial))
  const backTo = isNew ? '/rezepte' : `/rezepte/${recipe.id}`

  useEffect(() => {
    if (!dirty || saving) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (fieldError?.field === key) setFieldError(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setGeneralError(null)
    const input = toInput(form)
    if (!input.title) {
      setFieldError({ field: 'title', message: 'Bitte einen Titel eingeben.' })
      return
    }
    if (form.servings.trim() !== '' && input.servings === null) {
      setFieldError({ field: 'servings', message: 'Portionen müssen eine ganze Zahl von 1 bis 99 sein.' })
      return
    }
    setSaving(true)
    try {
      const saved = isNew ? await api.createRecipe(input) : await api.updateRecipe(recipe.id, input)
      navigate(`/rezepte/${saved.id}`, { replace: true })
    } catch (error) {
      setSaving(false)
      if (error instanceof RequestError && error.status === 422 && error.serverMessage && isField(error.field)) {
        setFieldError({ field: error.field, message: error.serverMessage })
      } else {
        setGeneralError('Das Rezept konnte nicht gespeichert werden. Bitte versuche es noch einmal.')
      }
    }
  }

  function cancel() {
    if (dirty) setConfirmingDiscard(true)
    else navigate(backTo)
  }

  const errorFor = (field: Field) =>
    fieldError?.field === field ? (
      <p className="form__error" id={`${field}-error`} role="alert">
        {fieldError.message}
      </p>
    ) : null

  return (
    <div className="page">
      <h1>{isNew ? 'Neues Rezept' : 'Rezept bearbeiten'}</h1>
      <form className="recipe-form" onSubmit={submit} noValidate>
        <div className="form__field">
          <label className="form__label" htmlFor="recipe-title">
            Titel
          </label>
          {titleEditable ? (
            <input
              id="recipe-title"
              className="input"
              value={form.title}
              maxLength={200}
              aria-invalid={fieldError?.field === 'title' || undefined}
              aria-describedby={fieldError?.field === 'title' ? 'title-error' : undefined}
              onChange={(event) => set('title', event.target.value)}
            />
          ) : (
            <>
              <p className="form__static" id="recipe-title">
                {form.title}
              </p>
              <p className="form__hint">Der Titel kommt aus der Quelle und lässt sich hier nicht ändern.</p>
            </>
          )}
          {errorFor('title')}
        </div>

        <div className="form__field">
          <label className="form__label" htmlFor="recipe-servings">
            Portionen
          </label>
          <input
            id="recipe-servings"
            className="input input--short"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            step={1}
            value={form.servings}
            aria-invalid={fieldError?.field === 'servings' || undefined}
            aria-describedby={fieldError?.field === 'servings' ? 'servings-error' : undefined}
            onChange={(event) => set('servings', event.target.value)}
          />
          {errorFor('servings')}
        </div>

        <fieldset className="form__field form__fieldset">
          <legend className="form__label">Zutaten</legend>
          <p className="form__hint" id="ingredients-hint">
            Eine Zutat pro Zeile, zum Beispiel „200 g Mehl“. Darunter siehst du, wie sie erkannt wird.
          </p>
          <IngredientListEditor
            lines={form.ingredients}
            onChange={(lines) => set('ingredients', lines)}
            invalid={fieldError?.field === 'ingredients'}
            describedBy={fieldError?.field === 'ingredients' ? 'ingredients-error' : 'ingredients-hint'}
          />
          {errorFor('ingredients')}
        </fieldset>

        <div className="form__field">
          <label className="form__label" htmlFor="recipe-instructions">
            Zubereitung
          </label>
          <p className="form__hint">Jede Zeile ist ein Schritt.</p>
          <textarea
            id="recipe-instructions"
            className="textarea"
            rows={8}
            value={form.instructions}
            aria-invalid={fieldError?.field === 'instructions' || undefined}
            aria-describedby={fieldError?.field === 'instructions' ? 'instructions-error' : undefined}
            onChange={(event) => set('instructions', event.target.value)}
          />
          {errorFor('instructions')}
        </div>

        {generalError && (
          <p className="form__error" role="alert">
            {generalError}
          </p>
        )}

        <div className="form__actions">
          <button type="button" className="button button--secondary" onClick={cancel} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </div>
      </form>

      {confirmingDiscard && (
        <Modal title="Änderungen verwerfen?" onClose={() => setConfirmingDiscard(false)}>
          <p>Deine Änderungen an diesem Rezept gehen verloren.</p>
          <div className="modal__actions">
            <button type="button" className="button button--secondary" onClick={() => setConfirmingDiscard(false)}>
              Weiter bearbeiten
            </button>
            <button type="button" className="button button--danger" onClick={() => navigate(backTo)}>
              Verwerfen
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function isField(field: string | null): field is Field {
  return field === 'title' || field === 'servings' || field === 'ingredients' || field === 'instructions'
}

function toInput(form: FormState): RecipeInput {
  const servingsText = form.servings.trim()
  const servings = /^\d+$/.test(servingsText) ? Number(servingsText) : null
  return {
    title: form.title.trim(),
    servings: servings !== null && servings >= 1 && servings <= 99 ? servings : null,
    ingredients: form.ingredients.map((line) => line.trim()).filter(Boolean),
    instructions: form.instructions
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  }
}

/** Vergleichsform: Leerzeilen und Leerraum am Rand zählen nicht als Änderung. */
function normalize(form: FormState) {
  return { ...toInput(form), servingsText: form.servings.trim() }
}
