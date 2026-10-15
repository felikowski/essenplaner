import { useCallback, useState } from 'react'
import { usePlannerApi } from '../api/context'
import { useAsyncData } from '../lib/useAsyncData'
import { LoadError, Loading } from './Status'

export function TagSettings() {
  const api = usePlannerApi()
  const load = useCallback(() => api.listTags(), [api])
  const { state, update, retry } = useAsyncData(load)
  const [error, setError] = useState<string | null>(null)

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError message="Die Tags konnten nicht geladen werden." onRetry={retry} />

  async function rename(name: string, newName: string) {
    if (!newName.trim() || newName.trim() === name) return
    setError(null)
    try {
      const tags = await api.renameTag(name, newName.trim())
      update(() => tags)
    } catch {
      setError('Der Tag konnte nicht umbenannt werden.')
    }
  }

  async function remove(name: string) {
    setError(null)
    try {
      const tags = await api.deleteTag(name)
      update(() => tags)
    } catch {
      setError('Der Tag konnte nicht gelöscht werden.')
    }
  }

  return (
    <fieldset className="settings-group">
      <legend className="form__label">Rezept-Tags</legend>
      <p className="form__hint">Beim Umbenennen in einen vorhandenen Tag werden beide zusammengeführt.</p>
      {state.data.length === 0 ? <p className="form__hint">Noch keine Tags vorhanden.</p> : (
        <ul className="settings-list">
          {state.data.map((tag) => <TagRow key={tag.name} name={tag.name} count={tag.count} onRename={rename} onDelete={remove} />)}
        </ul>
      )}
      {error && <p className="form__error" role="alert">{error}</p>}
    </fieldset>
  )
}

function TagRow({ name, count, onRename, onDelete }: { name: string; count: number; onRename: (name: string, next: string) => void; onDelete: (name: string) => void }) {
  const [draft, setDraft] = useState(name)
  return (
    <li className="settings-list__row">
      <input className="input settings-list__input" aria-label={`Tag ${name}`} value={draft} maxLength={30} onChange={(event) => setDraft(event.target.value)} onBlur={() => onRename(name, draft)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onRename(name, draft) } }} />
      <span className="tag-count">{count}</span>
      <button type="button" className="icon-button" aria-label={`Tag ${name} löschen`} onClick={() => onDelete(name)}>✕</button>
    </li>
  )
}
