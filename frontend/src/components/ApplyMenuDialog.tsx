import { useState, type FormEvent } from 'react'
import { usePlannerApi } from '../api/context'
import { formatFullDate, isValidDate, parseIsoDate, toIsoDate } from '../lib/isoWeek'
import { MEAL_LABELS } from '../lib/meals'
import type { ApplyMenuResult, IsoDate, Meal, Menu } from '../types'
import { Modal } from './Modal'

interface Props {
  menu: Menu
  hiddenMeals: Meal[]
  onApplied: (result: ApplyMenuResult, start: IsoDate) => void
  onClose: () => void
}

export function ApplyMenuDialog({ menu, hiddenMeals, onApplied, onClose }: Props) {
  const api = usePlannerApi()
  const [today] = useState(() => new Date())
  const tomorrow = addDays(today, 1)
  const [start, setStart] = useState<IsoDate>(toIsoDate(tomorrow))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const validStart = isValidDate(start)
  const end = validStart ? toIsoDate(addDays(parseIsoDate(start), menu.days - 1)) : start

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onApplied(await api.applyMenu(menu.id, start), start)
    } catch {
      setError('Das Menü konnte nicht eingeplant werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Einplanen: ${menu.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="week-actions">
          <button type="button" className="button button--secondary button--small" onClick={() => setStart(toIsoDate(tomorrow))}>Morgen</button>
          <button type="button" className="button button--secondary button--small" onClick={() => setStart(toIsoDate(nextMonday(today)))}>Nächster Montag</button>
        </div>
        <label className="form__label" htmlFor="menu-start">Startdatum</label>
        <input id="menu-start" className="input" type="date" value={start} required onChange={(event) => setStart(event.target.value)} />
        {validStart && <p className="form__hint">Vorschau: {formatFullDate(start)} – {formatFullDate(end)}</p>}
        {hiddenMeals.length > 0 && (
          <p className="notice">Enthält ausgeblendete Mahlzeiten: {hiddenMeals.map((meal) => MEAL_LABELS[meal]).join(', ')}. Diese Einträge bleiben im Plan erhalten.</p>
        )}
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="button" disabled={busy || !validStart}>Menü einplanen</button>
        </div>
      </form>
    </Modal>
  )
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function nextMonday(date: Date): Date {
  const days = ((8 - date.getDay()) % 7) || 7
  return addDays(date, days)
}
