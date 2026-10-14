import { useState, type FormEvent } from 'react'
import { usePlannerApi } from '../api/context'
import { RequestError } from '../api/request'
import type { Recipe } from '../types'
import { Modal } from './Modal'

interface Props {
  onImported: (recipe: Recipe) => void
  onClose: () => void
}

export function ImportRecipeDialog({ onImported, onClose }: Props) {
  const api = usePlannerApi()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onImported(await api.importRecipe(url.trim()))
    } catch (err) {
      setError(importErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Rezept hinzufügen" onClose={busy ? () => {} : onClose}>
      <form className="form" onSubmit={submit}>
        <label className="form__label" htmlFor="import-url">
          Link zur Rezeptseite
        </label>
        <input
          id="import-url"
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.chefkoch.de/rezepte/…"
          required
          value={url}
          disabled={busy}
          onChange={(event) => setUrl(event.target.value)}
        />
        <p className="form__hint">Funktioniert mit den meisten Rezeptseiten, etwa Chefkoch, Lecker oder Kochblogs.</p>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button type="submit" className="button" disabled={busy || url.trim() === ''}>
            {busy ? 'Wird importiert …' : 'Importieren'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function importErrorMessage(error: unknown): string {
  if (error instanceof RequestError && error.serverMessage && error.status < 500) return error.serverMessage
  if (error instanceof RequestError && error.status === 502 && error.serverMessage) return error.serverMessage
  return 'Der Import hat nicht geklappt. Bitte versuche es noch einmal.'
}
