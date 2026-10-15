import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { usePlannerApi } from '../api/context'
import { LoadError, Loading } from '../components/Status'
import { useAsyncData } from '../lib/useAsyncData'
import type { Staple } from '../types'

/** Vorratsliste: Dinge, die immer im Haus sein sollen. „Vorrat prüfen“ bringt die fehlenden auf die Liste. */
export function StaplesPage() {
  const api = usePlannerApi()
  const navigate = useNavigate()
  const load = useCallback(() => api.listStaples(), [api])
  const { state, update, retry } = useAsyncData(load)
  const [selected, setSelected] = useState<string[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError message="Der Vorrat konnte nicht geladen werden." onRetry={retry} />
  const staples = state.data

  async function save(action: () => Promise<Staple[]>) {
    setError(null)
    try {
      const next = await action()
      update(() => next)
      setSelected((current) => current.filter((id) => next.some((staple) => staple.id === id)))
      return true
    } catch {
      setError('Der Vorrat konnte nicht gespeichert werden. Bitte versuche es noch einmal.')
      return false
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    const line = text.trim()
    if (!line) return
    if (await save(() => api.createStaple(line))) setText('')
  }

  async function addToList() {
    setBusy(true)
    setError(null)
    try {
      await api.addStaplesToList(selected)
      const count = selected.length
      navigate('/einkauf', {
        state: { notice: count === 1 ? '1 Artikel aus dem Vorrat übernommen.' : `${count} Artikel aus dem Vorrat übernommen.` },
      })
    } catch {
      setError('Die Artikel konnten nicht übernommen werden. Bitte versuche es noch einmal.')
      setBusy(false)
    }
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((candidate) => candidate !== id)))
  }

  return (
    <div className="page staples-page">
      <div className="page-header">
        <h1>Vorrat</h1>
        <Link to="/einkauf" className="button button--secondary button--small">
          Zur Einkaufsliste
        </Link>
      </div>
      <p className="status">Kreuze an, was fehlt, und übernimm es auf die Einkaufsliste.</p>

      {staples.length === 0 ? (
        <p className="notice">Noch nichts im Vorrat. Füge unten Dinge hinzu, die immer im Haus sein sollen.</p>
      ) : (
        <ul className="staple-list">
          {staples.map((staple) => (
            <li key={staple.id} className="staple">
              <label className="checkbox staple__label">
                <input
                  type="checkbox"
                  checked={selected.includes(staple.id)}
                  onChange={(event) => toggle(staple.id, event.target.checked)}
                />
                {staple.text}
              </label>
              <button
                type="button"
                className="icon-button icon-button--quiet"
                aria-label={`${staple.text} aus dem Vorrat entfernen`}
                onClick={() => save(() => api.deleteStaple(staple.id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {staples.length > 0 && (
        <button type="button" className="button staples-page__submit" disabled={selected.length === 0 || busy} onClick={addToList}>
          {selected.length > 0 ? `${selected.length} auf die Einkaufsliste` : 'Auf die Einkaufsliste'}
        </button>
      )}

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      <form className="shopping-add" onSubmit={add}>
        <label className="visually-hidden" htmlFor="staple-add">
          Zum Vorrat hinzufügen
        </label>
        <input
          id="staple-add"
          className="input"
          value={text}
          maxLength={200}
          autoComplete="off"
          placeholder="Zum Vorrat hinzufügen, z. B. Kaffee"
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className="button button--secondary" disabled={!text.trim()}>
          Hinzufügen
        </button>
      </form>
    </div>
  )
}
