import { useState, type FormEvent } from 'react'
import { usePlannerApi } from '../api/context'
import { formatWeekLabel, shiftWeek } from '../lib/isoWeek'
import type { CopyMode, IsoWeek, WeekPlan } from '../types'
import { Modal } from './Modal'

interface Props {
  week: IsoWeek
  onCopied: (result: { week: WeekPlan; skipped: number }) => void
  onClose: () => void
}

/** Kopiert alle Einträge der Woche in eine der nächsten Wochen. Ist das Ziel belegt, wird nachgefragt. */
export function CopyWeekDialog({ week, onCopied, onClose }: Props) {
  const api = usePlannerApi()
  const targets = Array.from({ length: 8 }, (_, index) => shiftWeek(week, index + 1))
  const [target, setTarget] = useState(targets[0])
  const [askMode, setAskMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copy(mode: CopyMode) {
    setBusy(true)
    setError(null)
    try {
      onCopied(await api.copyWeek(week, target, mode))
    } catch {
      setError('Die Woche konnte nicht kopiert werden. Bitte versuche es noch einmal.')
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const plan = await api.getWeek(target)
      const occupied = Object.values(plan.days).some((entries) => entries.length > 0)
      setBusy(false)
      if (occupied) setAskMode(true)
      else await copy('append')
    } catch {
      setError('Die Zielwoche konnte nicht geladen werden.')
      setBusy(false)
    }
  }

  return (
    <Modal title="Woche kopieren" onClose={onClose}>
      {askMode ? (
        <>
          <p>{formatWeekLabel(target)} enthält schon Einträge. Sollen die kopierten ergänzt werden oder die vorhandenen ersetzen?</p>
          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="button button--secondary" onClick={onClose} disabled={busy}>
              Abbrechen
            </button>
            <button type="button" className="button button--danger" onClick={() => copy('replace')} disabled={busy}>
              Ersetzen
            </button>
            <button type="button" className="button" onClick={() => copy('append')} disabled={busy}>
              Ergänzen
            </button>
          </div>
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <label className="form__label" htmlFor="copy-target">
            Kopieren nach
          </label>
          <select
            id="copy-target"
            className="select"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            {targets.map((option) => (
              <option key={option} value={option}>
                {formatWeekLabel(option)}
              </option>
            ))}
          </select>
          <p className="form__hint">Jeder Eintrag landet am selben Wochentag in derselben Mahlzeit.</p>
          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="button button--secondary" onClick={onClose} disabled={busy}>
              Abbrechen
            </button>
            <button type="submit" className="button" disabled={busy}>
              Kopieren
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
