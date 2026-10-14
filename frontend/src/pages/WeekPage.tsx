import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import type { PlannerApi } from '../api/PlannerApi'
import { AddEntryDialog } from '../components/AddEntryDialog'
import { CopyWeekDialog } from '../components/CopyWeekDialog'
import { DayCard } from '../components/DayCard'
import { EntryActionsDialog } from '../components/EntryActionsDialog'
import { LoadError, Loading } from '../components/Status'
import { TargetDialog } from '../components/TargetDialog'
import {
  currentWeek,
  daysOfWeek,
  formatDayMonth,
  formatWeekday,
  formatWeekLabel,
  isValidWeek,
  nextWeek,
  previousWeek,
  toIsoDate,
} from '../lib/isoWeek'
import { entryTitle } from '../lib/entries'
import { MEAL_LABELS } from '../lib/meals'
import { useSettings } from '../lib/settingsContext'
import { useAsyncData } from '../lib/useAsyncData'
import type { IsoDate, IsoWeek, Meal, NewEntry, PlanEntry, Recipe, WeekPlan } from '../types'

export function WeekPage() {
  const { week = '' } = useParams()

  if (!isValidWeek(week)) {
    return (
      <div className="page">
        <h1>Diese Kalenderwoche gibt es nicht</h1>
        <p>
          <Link to="/">Zur aktuellen Woche</Link>
        </p>
      </div>
    )
  }

  // key: beim Wechsel der Woche beginnt die Ansicht mit frischem Zustand.
  return <WeekPlanView key={week} week={week} />
}

type Dialog =
  | { kind: 'add'; date: IsoDate; meal: Meal }
  | { kind: 'actions'; date: IsoDate; entry: PlanEntry }
  | { kind: 'move'; date: IsoDate; entry: PlanEntry }
  | { kind: 'leftover'; date: IsoDate; entry: PlanEntry }
  | { kind: 'copy' }

interface Notice {
  text: string
}

function WeekPlanView({ week }: { week: IsoWeek }) {
  const api = usePlannerApi()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const load = useCallback(async () => {
    const [plan, recipes] = await Promise.all([api.getWeek(week), api.listRecipes()])
    return { plan, recipes, planned: await withPlannedRecipes(api, [plan], recipes) }
  }, [api, week])
  const { state, update, retry } = useAsyncData(load)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [busyDate, setBusyDate] = useState<IsoDate | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const notice = (location.state as Notice | null)?.text ?? null

  // Einmal beim Öffnen der Woche festgehalten, damit sich die Ansicht nicht beim Rendern ändert.
  const [now] = useState(() => new Date())
  const today = toIsoDate(now)
  const thisWeek = currentWeek(now)
  const days = daysOfWeek(week)

  /** Führt eine Änderung aus und übernimmt die gelieferten Wochenpläne in die Ansicht. */
  async function change(date: IsoDate, action: () => Promise<WeekPlan[]>) {
    setDialog(null)
    setSaveError(null)
    setBusyDate(date)
    try {
      const plans = await action()
      const plan = plans.find((candidate) => candidate.week === week)
      const known = state.status === 'ready' ? state.data.planned : []
      const planned = await withPlannedRecipes(api, plans, known)
      update((data) => ({ ...data, plan: plan ?? data.plan, planned }))
    } catch {
      setSaveError(`${formatWeekday(date)} konnte nicht gespeichert werden. Bitte versuche es noch einmal.`)
    } finally {
      setBusyDate(null)
    }
  }

  const addEntry = (entry: NewEntry) => change(entry.date, () => api.createEntry(entry))

  return (
    <div className="page week-page">
      <div className="week-header">
        <div>
          <h1 className="week-header__title">{formatWeekLabel(week)}</h1>
          <p className="week-header__range">
            {formatDayMonth(days[0])} – {formatDayMonth(days[6])}
          </p>
        </div>
        <nav className="week-nav" aria-label="Wochen wechseln">
          <Link to={`/woche/${previousWeek(week)}`} className="button button--secondary" aria-label="Vorige Woche">
            ‹
          </Link>
          {week === thisWeek ? (
            <span className="button button--secondary" aria-disabled="true">
              Heute
            </span>
          ) : (
            <Link to={`/woche/${thisWeek}`} className="button button--secondary">
              Heute
            </Link>
          )}
          <Link to={`/woche/${nextWeek(week)}`} className="button button--secondary" aria-label="Nächste Woche">
            ›
          </Link>
        </nav>
      </div>
      <div className="week-actions">
        <button type="button" className="button button--secondary button--small" onClick={() => setDialog({ kind: 'copy' })}>
          Woche kopieren
        </button>
        <button type="button" className="button button--secondary button--small" onClick={() => window.print()}>
          Drucken
        </button>
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {saveError && (
        <div className="alert" role="alert">
          <p>{saveError}</p>
        </div>
      )}

      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError message="Der Wochenplan konnte nicht geladen werden." onRetry={retry} />}
      {state.status === 'ready' && (
        <>
          <ol className="day-list">
            {days.map((date) => (
              <DayCard
                key={date}
                date={date}
                entries={state.data.plan.days[date] ?? []}
                visibleMeals={settings.visibleMeals}
                recipes={state.data.planned}
                isToday={date === today}
                busy={date === busyDate}
                onAdd={(meal) => setDialog({ kind: 'add', date, meal })}
                onOpenEntry={(entry) => setDialog({ kind: 'actions', date, entry })}
              />
            ))}
          </ol>

          {dialog?.kind === 'add' && (
            <AddEntryDialog
              label={`${formatWeekday(dialog.date)}, ${formatDayMonth(dialog.date)} · ${MEAL_LABELS[dialog.meal]}`}
              recipes={state.data.recipes}
              onAddRecipe={(recipeId) => addEntry({ date: dialog.date, meal: dialog.meal, kind: 'recipe', recipeId })}
              onAddText={(kind, text) => addEntry({ date: dialog.date, meal: dialog.meal, kind, text })}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog?.kind === 'actions' && (
            <EntryActionsDialog
              entry={dialog.entry}
              title={entryTitle(dialog.entry, findRecipe(state.data.planned, dialog.entry))}
              recipe={findRecipe(state.data.planned, dialog.entry)}
              busy={busyDate !== null}
              onSetServings={(servings) => change(dialog.date, () => api.updateEntry(dialog.entry.id, { servings }))}
              onMove={() => setDialog({ ...dialog, kind: 'move' })}
              onLeftover={() => setDialog({ ...dialog, kind: 'leftover' })}
              onDelete={() => change(dialog.date, () => api.deleteEntry(dialog.entry.id))}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog?.kind === 'move' && (
            <TargetDialog
              title={`Verschieben: ${entryTitle(dialog.entry, findRecipe(state.data.planned, dialog.entry))}`}
              confirmLabel="Verschieben"
              days={days}
              initialDate={dialog.date}
              initialMeal={dialog.entry.meal}
              onConfirm={(date, meal) => change(dialog.date, () => api.updateEntry(dialog.entry.id, { date, meal }))}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog?.kind === 'leftover' && (
            <TargetDialog
              title={`Reste einplanen: ${entryTitle(dialog.entry, findRecipe(state.data.planned, dialog.entry))}`}
              confirmLabel="Reste einplanen"
              days={days}
              initialDate={nextDay(dialog.date)}
              initialMeal={dialog.entry.meal}
              onConfirm={(date, meal) => addEntry({ date, meal, kind: 'leftover', leftoverOf: dialog.entry.id })}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog?.kind === 'copy' && (
            <CopyWeekDialog
              week={week}
              onCopied={({ week: target, skipped }) => {
                setDialog(null)
                const text =
                  skipped > 0
                    ? `${formatWeekLabel(week)} wurde kopiert. ${skipped === 1 ? '1 Eintrag wurde' : `${skipped} Einträge wurden`} übersprungen, weil das Rezept nicht mehr verfügbar ist.`
                    : `${formatWeekLabel(week)} wurde kopiert.`
                navigate(`/woche/${target.week}`, { state: { text } satisfies Notice })
              }}
              onClose={() => setDialog(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

function findRecipe(recipes: Recipe[], entry: PlanEntry): Recipe | undefined {
  return recipes.find((recipe) => recipe.id === entry.recipeId)
}

function nextDay(date: IsoDate): IsoDate {
  const [year, month, day] = date.split('-').map(Number)
  return toIsoDate(new Date(year, month - 1, day + 1))
}

/**
 * Liefert die Rezepte, die in den Plänen vorkommen. Entfernte Rezepte fehlen in der Rezeptliste und werden
 * einzeln nachgeladen, damit ihr Titel im Plan sichtbar bleibt.
 */
async function withPlannedRecipes(api: PlannerApi, plans: WeekPlan[], known: Recipe[]): Promise<Recipe[]> {
  const ids = new Set(
    plans.flatMap((plan) => Object.values(plan.days).flatMap((entries) => entries.map((entry) => entry.recipeId))),
  )
  const missing = [...ids].filter((id): id is string => !!id && !known.some((recipe) => recipe.id === id))
  const loaded = await Promise.all(missing.map((id) => api.getRecipe(id)))
  return [...known, ...loaded.filter((recipe): recipe is Recipe => recipe !== null)]
}
