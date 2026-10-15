import { useCallback, useState, type FormEvent } from 'react'
import { usePlannerApi } from '../api/context'
import { RequestError } from '../api/request'
import { useAsyncData } from '../lib/useAsyncData'
import type { ShoppingAlias, ShoppingList } from '../types'
import { LoadError, Loading } from './Status'

interface Data {
  list: ShoppingList
  aliases: ShoppingAlias[]
}

/** Einstellungen der Einkaufsliste: Kategorien, Geschäfte und gemerkte Zusammenführungen. */
export function ShoppingSettings() {
  const api = usePlannerApi()
  const load = useCallback(async (): Promise<Data> => {
    const [list, aliases] = await Promise.all([api.getShoppingList(), api.listShoppingAliases()])
    if (!list) throw new Error('Liste fehlt')
    return { list, aliases }
  }, [api])
  const { state, update, retry } = useAsyncData(load)
  const [error, setError] = useState<string | null>(null)

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError message="Die Einstellungen der Einkaufsliste konnten nicht geladen werden." onRetry={retry} />
  const { list, aliases } = state.data

  async function saveList(action: () => Promise<ShoppingList>) {
    setError(null)
    try {
      const next = await action()
      update((data) => ({ ...data, list: next }))
      return true
    } catch (caught) {
      setError(
        caught instanceof RequestError && caught.serverMessage && caught.status === 422
          ? caught.serverMessage
          : 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es noch einmal.',
      )
      return false
    }
  }

  function move(index: number, delta: number) {
    const ids = list.categories.map((category) => category.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    void saveList(() => api.reorderShoppingCategories(ids))
  }

  async function removeAlias(fromKey: string) {
    setError(null)
    try {
      const next = await api.deleteShoppingAlias(fromKey)
      update((data) => ({ ...data, aliases: next }))
    } catch {
      setError('Die Zusammenführung konnte nicht entfernt werden.')
    }
  }

  return (
    <>
      <fieldset className="settings-group">
        <legend className="form__label">Kategorien der Einkaufsliste</legend>
        <p className="form__hint">Die Reihenfolge entspricht deinem Weg durch den Laden.</p>
        <ul className="settings-list">
          {list.categories.map((category, index) => (
            <li key={category.id} className="settings-list__row">
              <NameField
                label={`Kategorie ${category.name}`}
                value={category.name}
                onSave={(name) => saveList(() => api.renameShoppingCategory(category.id, name))}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`${category.name} nach oben`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`${category.name} nach unten`}
                disabled={index === list.categories.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              {category.removable && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${category.name} löschen`}
                  onClick={() => saveList(() => api.deleteShoppingCategory(category.id))}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        <AddForm label="Neue Kategorie" onAdd={(name) => saveList(() => api.createShoppingCategory(name))} />
      </fieldset>

      <fieldset className="settings-group">
        <legend className="form__label">Geschäfte</legend>
        <p className="form__hint">Ordne Artikel einem Geschäft zu und filtere die Liste beim Einkaufen danach.</p>
        {list.stores.length > 0 && (
          <ul className="settings-list">
            {list.stores.map((store) => (
              <li key={store.id} className="settings-list__row">
                <NameField
                  label={`Geschäft ${store.name}`}
                  value={store.name}
                  onSave={(name) => saveList(() => api.renameShoppingStore(store.id, name))}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${store.name} löschen`}
                  onClick={() => saveList(() => api.deleteShoppingStore(store.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddForm label="Neues Geschäft" onAdd={(name) => saveList(() => api.createShoppingStore(name))} />
      </fieldset>

      <fieldset className="settings-group">
        <legend className="form__label">Gemerkte Zusammenführungen</legend>
        {aliases.length === 0 ? (
          <p className="form__hint">Noch keine. Führst du auf der Liste zwei Artikel zusammen, erscheint das hier.</p>
        ) : (
          <ul className="settings-list">
            {aliases.map((alias) => (
              <li key={alias.fromKey} className="settings-list__row">
                <span className="settings-list__text">
                  {alias.fromName} → {alias.toName}
                </span>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  aria-label={`Zusammenführung ${alias.fromName} entfernen`}
                  onClick={() => removeAlias(alias.fromKey)}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

/** Eingabefeld, das beim Verlassen oder mit Enter speichert, wenn sich der Name geändert hat. */
function NameField({ label, value, onSave }: { label: string; value: string; onSave: (name: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(value)
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    // Der Server hat einen anderen Namen geliefert (etwa nach dem Umbenennen).
    setShown(value)
    setDraft(value)
  }

  async function commit() {
    const name = draft.trim()
    if (!name || name === value) {
      setDraft(value)
      return
    }
    if (!(await onSave(name))) setDraft(value)
  }

  return (
    <input
      className="input settings-list__input"
      aria-label={label}
      value={draft}
      maxLength={60}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void commit()
        }
      }}
    />
  )
}

function AddForm({ label, onAdd }: { label: string; onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() && (await onAdd(name.trim()))) setName('')
  }

  return (
    <form className="settings-list__add" onSubmit={submit}>
      <input
        className="input"
        aria-label={label}
        placeholder={label}
        value={name}
        maxLength={60}
        onChange={(event) => setName(event.target.value)}
      />
      <button type="submit" className="button button--secondary" disabled={!name.trim()}>
        Anlegen
      </button>
    </form>
  )
}
