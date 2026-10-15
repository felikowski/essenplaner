import { useState, type FormEvent } from 'react'
import { isValidDate, parseIsoDate, toIsoDate } from '../lib/isoWeek'
import type { IsoDate } from '../types'
import { Modal } from './Modal'

interface Props {
  today: IsoDate
  busy: boolean
  error: string | null
  onImport: (from: IsoDate, to: IsoDate) => void
  onClose: () => void
}

function addDays(date: IsoDate, days: number): IsoDate {
  const parsed = parseIsoDate(date)
  return toIsoDate(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + days))
}

/** Wählt den Zeitraum, aus dem die Zutaten übernommen werden; voreingestellt heute bis in sechs Tagen. */
export function ImportFromPlanDialog({ today, busy, error, onImport, onClose }: Props) {
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 6))
  const valid = isValidDate(from) && isValidDate(to) && from <= to

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid) onImport(from, to)
  }

  return (
    <Modal title="Aus dem Plan übernehmen" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="form__hint">
          Zutaten aller Rezepte und Einzelzutaten im Zeitraum, auf die geplanten Portionen umgerechnet. Reste und schon
          übernommene Einträge werden übersprungen.
        </p>
        <label className="form__label" htmlFor="import-from">
          Von
        </label>
        <input id="import-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label className="form__label" htmlFor="import-to">
          Bis
        </label>
        <input id="import-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="modal__actions">
          <button type="submit" className="button" disabled={!valid || busy}>
            Übernehmen
          </button>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </form>
    </Modal>
  )
}
