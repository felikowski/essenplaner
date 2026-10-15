import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { usePlannerApi } from '../api/context'
import { RequestError } from '../api/request'
import { LoadError, Loading } from '../components/Status'
import { useAsyncData } from '../lib/useAsyncData'

export function MenusPage() {
  const api = usePlannerApi()
  const navigate = useNavigate()
  const load = useCallback(() => api.listMenus(), [api])
  const { state, retry } = useAsyncData(load)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const menu = await api.createMenu({ name })
      navigate(`/menues/${menu.id}`)
    } catch (reason) {
      setError(reason instanceof RequestError && reason.serverMessage ? reason.serverMessage : 'Das Menü konnte nicht angelegt werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Menüs</h1>
          <p>Bewährte Pläne speichern und später wieder einplanen.</p>
        </div>
        <Link to="/" className="button button--secondary">Zum Wochenplan</Link>
      </div>
      <form className="form menu-create" onSubmit={create}>
        <label className="form__label" htmlFor="new-menu-name">Neues Menü</label>
        <div className="form__row">
          <input id="new-menu-name" className="input" value={name} maxLength={100} placeholder="z. B. Herbstwoche" required onChange={(event) => setName(event.target.value)} />
          <button type="submit" className="button" disabled={busy || !name.trim()}>Anlegen</button>
        </div>
        {error && <p className="alert" role="alert">{error}</p>}
      </form>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <LoadError message="Die Menüs konnten nicht geladen werden." onRetry={retry} />}
      {state.status === 'ready' && state.data.length === 0 && (
        <p className="empty-state">Noch keine Menüs. Speichere im Wochenplan über „Als Menü speichern“ einen Zeitraum oder lege hier ein neues Menü an.</p>
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className="menu-list">
          {state.data.map((menu) => (
            <li key={menu.id}>
              <Link to={`/menues/${menu.id}`} className="menu-list__link">
                <strong>{menu.name}</strong>
                <span>{menu.days} {menu.days === 1 ? 'Tag' : 'Tage'} · {menu.recipeCount} {menu.recipeCount === 1 ? 'Rezept' : 'Rezepte'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
