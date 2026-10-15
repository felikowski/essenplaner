import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { usePlannerApi } from '../api/context'
import { LoadError, Loading } from '../components/Status'
import { findRecipesByIngredients } from '../lib/recipeQuery'
import { useAsyncData } from '../lib/useAsyncData'

export function IngredientSearchPage() {
  const api = usePlannerApi()
  const load = useCallback(async () => {
    const [recipes, aliases] = await Promise.all([api.listRecipes(), api.listShoppingAliases()])
    return { recipes, aliases }
  }, [api])
  const { state, retry } = useAsyncData(load)
  const [draft, setDraft] = useState('')
  const [ingredients, setIngredients] = useState<string[]>([])
  const results = useMemo(() => state.status === 'ready' ? findRecipesByIngredients(state.data.recipes, ingredients, state.data.aliases) : [], [ingredients, state])

  function submit(event: FormEvent) {
    event.preventDefault()
    setIngredients(draft.split(/[,\n]/).map((value) => value.trim()).filter(Boolean))
  }

  return (
    <div className="page">
      <p><Link to="/rezepte">‹ Alle Rezepte</Link></p>
      <h1>Was habe ich da?</h1>
      <p className="status">Gib mehrere Zutaten mit Komma oder je einer neuen Zeile ein.</p>
      <form className="ingredient-search" onSubmit={submit}>
        <label className="form__label" htmlFor="ingredient-search">Vorhandene Zutaten</label>
        <textarea id="ingredient-search" className="textarea" rows={3} value={draft} placeholder="Zucchini, Feta" onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" className="button" disabled={!draft.trim()}>Rezepte finden</button>
      </form>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError message="Die Rezepte konnten nicht geladen werden." onRetry={retry} />}
      {state.status === 'ready' && ingredients.length > 0 && (results.length === 0 ? (
        <p className="status">Kein Rezept mit diesen Zutaten</p>
      ) : (
        <ul className="ingredient-results">
          {results.map(({ recipe, matches, missing }) => (
            <li key={recipe.id}>
              <Link to={`/rezepte/${recipe.id}`} className="ingredient-result">
                <strong>{recipe.title}</strong>
                <span>{matches.map((name) => `${name} ✓`).join(' · ')}</span>
                {missing.length > 0 && <span className="ingredient-result__missing">Fehlt: {missing.join(', ')}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
