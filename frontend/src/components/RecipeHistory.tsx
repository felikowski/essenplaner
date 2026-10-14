import { useCallback } from 'react'
import { Link } from 'react-router'
import { usePlannerApi } from '../api/context'
import { formatFullDate, parseIsoDate, weekOf } from '../lib/isoWeek'
import { useAsyncData } from '../lib/useAsyncData'

/** „Zuletzt geplant: Fr 16.10.2026 · insgesamt 2-mal“ mit aufklappbarer Liste aller Termine. */
export function RecipeHistory({ recipeId }: { recipeId: string }) {
  const api = usePlannerApi()
  const load = useCallback(() => api.getRecipeHistory(recipeId), [api, recipeId])
  const { state } = useAsyncData(load)

  if (state.status !== 'ready') return null
  const dates = state.data
  if (dates.length === 0) return <p className="recipe-history">Noch nie geplant</p>

  return (
    <details className="recipe-history">
      <summary>
        Zuletzt geplant: {formatFullDate(dates[0])} · insgesamt {dates.length}-mal
      </summary>
      <ul>
        {dates.map((date, index) => (
          <li key={`${date}-${index}`}>
            <Link to={`/woche/${weekOf(parseIsoDate(date))}`}>{formatFullDate(date)}</Link>
          </li>
        ))}
      </ul>
    </details>
  )
}
