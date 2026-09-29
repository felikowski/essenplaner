import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { DayCard } from '../components/DayCard'
import { RecipePicker } from '../components/RecipePicker'
import { LoadError, Loading } from '../components/Status'
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
import { useAsyncData } from '../lib/useAsyncData'
import type { IsoDate, IsoWeek } from '../types'

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

function WeekPlanView({ week }: { week: IsoWeek }) {
  const api = usePlannerApi()
  const load = useCallback(
    () => Promise.all([api.getWeek(week), api.listRecipes()]).then(([plan, recipes]) => ({ plan, recipes })),
    [api, week],
  )
  const { state, update, retry } = useAsyncData(load)
  const [pickerDate, setPickerDate] = useState<IsoDate | null>(null)
  const [savingDate, setSavingDate] = useState<IsoDate | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Einmal beim Öffnen der Woche festgehalten, damit sich die Ansicht nicht beim Rendern ändert.
  const [now] = useState(() => new Date())
  const today = toIsoDate(now)
  const thisWeek = currentWeek(now)
  const days = daysOfWeek(week)

  async function assign(date: IsoDate, recipeId: string | null) {
    setPickerDate(null)
    setSaveError(null)
    setSavingDate(date)
    try {
      const plan = await api.setDay(date, recipeId)
      update((data) => ({ ...data, plan }))
    } catch {
      setSaveError(`${formatWeekday(date)} konnte nicht gespeichert werden. Bitte versuche es noch einmal.`)
    } finally {
      setSavingDate(null)
    }
  }

  return (
    <div className="page">
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
            {days.map((date) => {
              const recipeId = state.data.plan.days[date] ?? null
              return (
                <DayCard
                  key={date}
                  date={date}
                  recipeId={recipeId}
                  recipe={state.data.recipes.find((recipe) => recipe.id === recipeId)}
                  isToday={date === today}
                  saving={date === savingDate}
                  onPick={() => setPickerDate(date)}
                />
              )
            })}
          </ol>
          {pickerDate && (
            <RecipePicker
              recipes={state.data.recipes}
              dayLabel={`${formatWeekday(pickerDate)}, ${formatDayMonth(pickerDate)}`}
              selectedId={state.data.plan.days[pickerDate] ?? null}
              onSelect={(recipeId) => {
                if (recipeId === (state.data.plan.days[pickerDate] ?? null)) setPickerDate(null)
                else void assign(pickerDate, recipeId)
              }}
              onClose={() => setPickerDate(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
