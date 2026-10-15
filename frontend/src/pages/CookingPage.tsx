import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { Modal } from '../components/Modal'
import { ServingsPicker } from '../components/ServingsPicker'
import { SubstitutionHint } from '../components/SubstitutionHint'
import { LoadError, Loading } from '../components/Status'
import { formatServings } from '../lib/recipes'
import { scaleIngredient } from '../lib/scale'
import { resolveStepAmounts } from '../lib/stepAmounts'
import { findStepTimes } from '../lib/stepTimes'
import { useTimers } from '../lib/timerContext'
import { useAsyncData } from '../lib/useAsyncData'
import { useWakeLock } from '../lib/useWakeLock'
import { useServingsParam } from '../lib/useServingsParam'
import type { Ingredient, Recipe } from '../types'

export function CookingPage() {
  const { id = '' } = useParams()
  const api = usePlannerApi()
  const load = useCallback(() => api.getRecipe(id), [api, id])
  const { state, retry } = useAsyncData(load)

  if (state.status === 'loading') return <div className="page"><Loading /></div>
  if (state.status === 'error') return <div className="page"><LoadError message="Die Kochansicht konnte nicht geladen werden." onRetry={retry} /></div>
  if (!state.data) return <div className="page"><h1>Rezept nicht gefunden</h1><Link to="/rezepte">Zur Rezeptliste</Link></div>
  return <CookingView recipe={state.data} />
}

function CookingView({ recipe }: { recipe: Recipe }) {
  const location = useLocation()
  const { supported } = useWakeLock()
  const { startTimer } = useTimers()
  const [servings, setServings] = useServingsParam(recipe.servings)
  const [mode, setMode] = useState<'overview' | 'steps'>('overview')
  const [stepIndex, setStepIndex] = useState(0)
  const [checkedIngredients, setCheckedIngredients] = useState(() => new Set<number>())
  const [checkedSteps, setCheckedSteps] = useState(() => new Set<number>())
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const ingredients = recipe.ingredients ?? []
  const instructions = recipe.instructions ?? []
  const factor = servings !== undefined && recipe.servings !== undefined ? servings / recipe.servings : 1
  const hasContent = ingredients.length > 0 || instructions.length > 0

  const changeStep = useCallback((change: number) => {
    setStepIndex((current) => Math.max(0, Math.min(instructions.length - 1, current + change)))
  }, [instructions.length])

  useEffect(() => {
    if (mode !== 'steps') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') changeStep(-1)
      if (event.key === 'ArrowRight') changeStep(1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [changeStep, mode])

  if (!hasContent) {
    return (
      <div className="page cooking-page">
        <p><Link to={`/rezepte/${recipe.id}${location.search}`}>‹ Zum Rezept</Link></p>
        <h1>{recipe.title}</h1>
        <p className="notice">Für dieses Rezept sind noch keine Zutaten oder Zubereitungsschritte erfasst.</p>
      </div>
    )
  }

  function toggle(setter: typeof setCheckedIngredients, index: number) {
    setter((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function startStepTimer(durationMs: number, index: number) {
    startTimer({ name: `${recipe.title} · Schritt ${index + 1}`, durationMs, recipeId: recipe.id })
  }

  function pointerDown(event: PointerEvent) {
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  function pointerUp(event: PointerEvent) {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return
    changeStep(dx < 0 ? 1 : -1)
  }

  return (
    <div className="page cooking-page">
      <p className="no-print"><Link to={`/rezepte/${recipe.id}${location.search}`}>‹ Zum Rezept</Link></p>
      <header className="cooking-header">
        <div>
          <p className="cooking-header__eyebrow">Kochansicht</p>
          <h1>{recipe.title}</h1>
        </div>
        <div className="cooking-mode no-print" role="group" aria-label="Ansicht">
          <button type="button" aria-pressed={mode === 'overview'} onClick={() => setMode('overview')}>Überblick</button>
          {instructions.length > 0 && <button type="button" aria-pressed={mode === 'steps'} onClick={() => setMode('steps')}>Schritt für Schritt</button>}
        </div>
      </header>
      {!supported && <p className="notice no-print">Dieser Browser kann den Bildschirm nicht automatisch eingeschaltet lassen.</p>}
      {servings !== undefined && recipe.servings !== undefined && (
        <section className="cooking-servings no-print" aria-label="Portionen wählen">
          <h2>{formatServings(servings)}</h2>
          <ServingsPicker servings={servings} recipeServings={recipe.servings} onChange={setServings} />
        </section>
      )}

      {mode === 'overview' ? (
        <div className="cooking-overview">
          {ingredients.length > 0 && (
            <section>
              <h2>Zutaten</h2>
              <IngredientChecklist ingredients={ingredients} factor={factor} checked={checkedIngredients} onToggle={(index) => toggle(setCheckedIngredients, index)} />
            </section>
          )}
          {instructions.length > 0 && (
            <section>
              <h2>Zubereitung</h2>
              <ol className="cooking-steps">
                {instructions.map((step, index) => (
                  <li key={index} className={checkedSteps.has(index) ? 'is-checked' : ''}>
                    <button type="button" className="cooking-check" role="checkbox" aria-checked={checkedSteps.has(index)} aria-label={`Schritt ${index + 1} erledigt`} onClick={() => toggle(setCheckedSteps, index)}>✓</button>
                    <p><TimedStep recipe={recipe} step={step} index={index} servings={servings} onStart={startStepTimer} /></p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      ) : (
        <section className="step-mode" onPointerDown={pointerDown} onPointerUp={pointerUp}>
          <p className="step-mode__count">Schritt {stepIndex + 1} von {instructions.length}</p>
          <div className="step-mode__card">
            <TimedStep recipe={recipe} step={instructions[stepIndex]} index={stepIndex} servings={servings} onStart={startStepTimer} />
          </div>
          <div className="step-mode__actions no-print">
            <button type="button" className="button button--secondary" onClick={() => changeStep(-1)} disabled={stepIndex === 0}>Zurück</button>
            {ingredients.length > 0 && <button type="button" className="button button--secondary" onClick={() => setIngredientsOpen(true)}>Zutaten</button>}
            <button type="button" className="button" onClick={() => changeStep(1)} disabled={stepIndex === instructions.length - 1}>Weiter</button>
          </div>
        </section>
      )}

      {ingredientsOpen && (
        <Modal title="Zutaten" onClose={() => setIngredientsOpen(false)}>
          <div className="cooking-ingredients-modal">
            <IngredientChecklist ingredients={ingredients} factor={factor} checked={checkedIngredients} onToggle={(index) => toggle(setCheckedIngredients, index)} />
          </div>
          <div className="modal__actions"><button type="button" className="button" onClick={() => setIngredientsOpen(false)}>Schließen</button></div>
        </Modal>
      )}
    </div>
  )
}

function IngredientChecklist({ ingredients, factor, checked, onToggle }: {
  ingredients: Ingredient[]
  factor: number
  checked: Set<number>
  onToggle: (index: number) => void
}) {
  return (
    <ul className="cooking-ingredients">
      {ingredients.map((ingredient, index) => (
        <li key={index} className={checked.has(index) ? 'is-checked' : ''}>
          <button type="button" role="checkbox" aria-checked={checked.has(index)} onClick={() => onToggle(index)}>
            <span aria-hidden="true">✓</span><span>{scaleIngredient(ingredient, factor)}</span>
          </button>
          <SubstitutionHint ingredient={ingredient} factor={factor} />
        </li>
      ))}
    </ul>
  )
}

function TimedStep({ recipe, step, index, servings, onStart }: {
  recipe: Recipe
  step: string
  index: number
  servings?: number
  onStart: (durationMs: number, index: number) => void
}) {
  const resolved = resolveStepAmounts(step, recipe.servings, servings).map((part) => part.text).join('')
  return findStepTimes(resolved).map((part, partIndex) => part.kind === 'time' ? (
    <button
      key={partIndex}
      type="button"
      className="step-time no-print"
      aria-label={`Timer über ${part.text} starten`}
      onClick={() => onStart(part.durationMs, index)}
    >
      {part.text}
    </button>
  ) : part.text)
}
