import { useState, type FormEvent } from 'react'
import { usePlannerApi } from '../api/context'
import { RequestError } from '../api/request'
import type { IsoDate, Menu } from '../types'
import { Modal } from './Modal'

interface Props {
  from: IsoDate
  to: IsoDate
  onSaved: (menu: Menu) => void
  onClose: () => void
}

/** Speichert einen frei wählbaren Zeitraum des Plans als Menü. */
export function MenuSaveDialog({ from: initialFrom, to: initialTo, onSaved, onClose }: Props) {
  const api = usePlannerApi()
  const [name, setName] = useState('')
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onSaved(await api.createMenu({ name, from, to }))
    } catch (reason) {
      setError(reason instanceof RequestError && reason.serverMessage ? reason.serverMessage : 'Das Menü konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Als Menü speichern" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="form__label" htmlFor="menu-save-name">Name</label>
        <input id="menu-save-name" className="input" value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} />
        <div className="form__row">
          <label className="form__field" htmlFor="menu-save-from">
            <span className="form__label">Von</span>
            <input id="menu-save-from" className="input" type="date" value={from} required onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="form__field" htmlFor="menu-save-to">
            <span className="form__label">Bis</span>
            <input id="menu-save-to" className="input" type="date" value={to} required onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="button" disabled={busy || !name.trim()}>Speichern</button>
        </div>
      </form>
    </Modal>
  )
}
