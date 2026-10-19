import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { usePlannerApi } from '../api/context'
import { RequestError } from '../api/request'
import { ImportFromPlanDialog } from '../components/ImportFromPlanDialog'
import { ShoppingItemDialog } from '../components/ShoppingItemDialog'
import { ShoppingVoiceDialog } from '../components/ShoppingVoiceDialog'
import { LoadError, Loading } from '../components/Status'
import { toIsoDate } from '../lib/isoWeek'
import { groupByCategory, shareText, visibleUnder } from '../lib/shopping'
import { useShoppingList } from '../lib/useShoppingList'
import { useWakeLock } from '../lib/useWakeLock'
import type { IsoDate, ShoppingItem, ShoppingItemPatch, ShoppingList } from '../types'

export const STORE_FILTER_KEY = 'essenplaner.shoppingStore'

function readStoreFilter(): string | null {
  try {
    return localStorage.getItem(STORE_FILTER_KEY)
  } catch {
    return null
  }
}

function writeStoreFilter(storeId: string | null) {
  try {
    if (storeId) localStorage.setItem(STORE_FILTER_KEY, storeId)
    else localStorage.removeItem(STORE_FILTER_KEY)
  } catch {
    // Ohne Speicher gilt der Filter nur bis zum Neuladen.
  }
}

type Dialog = { kind: 'item'; id: string } | { kind: 'import' } | { kind: 'voice' }

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof RequestError && error.status === 422 && error.serverMessage ? error.serverMessage : fallback
}

export function ShoppingPage() {
  const api = usePlannerApi()
  const location = useLocation()
  const { list, error, apply, patchLocal, refresh, retry } = useShoppingList()
  const [text, setText] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [notice, setNotice] = useState<ReactNode>((location.state as { notice?: string } | null)?.notice ?? null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [storeFilter, setStoreFilter] = useState<string | null>(readStoreFilter)
  const [today] = useState(() => toIsoDate(new Date()))
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  useWakeLock()

  useEffect(() => {
    let active = true
    // Ohne Sprachdienst (oder wenn die Abfrage scheitert) fehlt nur der Knopf.
    api.getVoiceAvailability().then(
      (available) => active && setVoiceAvailable(available),
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [api])

  if (error) return <LoadError message="Die Einkaufsliste konnte nicht geladen werden." onRetry={retry} />
  if (!list) return <Loading />

  // Ein gemerktes Geschäft, das es nicht mehr gibt, filtert nicht.
  const activeStore = list.stores.some((store) => store.id === storeFilter) ? storeFilter : null
  const visible = list.items.filter((item) => visibleUnder(item, activeStore))
  const hasChecked = list.items.some((item) => item.checked)
  const openItem = dialog?.kind === 'item' ? list.items.find((item) => item.id === dialog.id) : undefined

  /** Führt eine Änderung aus und übernimmt die gelieferte Liste; bei Fehlern wird neu geladen. */
  async function change(action: () => Promise<ShoppingList>, fallback = 'Die Änderung konnte nicht gespeichert werden.') {
    setSaveError(null)
    try {
      apply(await action())
      return true
    } catch (caught) {
      setSaveError(errorMessage(caught, `${fallback} Bitte versuche es noch einmal.`))
      void refresh()
      return false
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    const line = text.trim()
    if (!line) return
    setText('')
    if (!(await change(() => api.addShoppingItem(line), 'Der Artikel konnte nicht hinzugefügt werden.'))) setText(line)
  }

  function toggle(item: ShoppingItem) {
    const checked = !item.checked
    patchLocal((current) => ({
      ...current,
      items: current.items.map((candidate) => (candidate.id === item.id ? { ...candidate, checked } : candidate)),
    }))
    void change(() => api.setShoppingItemChecked(item.id, checked))
  }

  async function runImport(from: IsoDate, to: IsoDate) {
    setBusy(true)
    setImportError(null)
    try {
      const result = await api.importShoppingFromPlan(from, to)
      apply(result.list)
      setDialog(null)
      setNotice(
        result.withoutIngredients.length > 0 ? (
          <>
            Ohne Zutaten: {result.withoutIngredients.map((recipe) => recipe.title).join(', ')}.{' '}
            {result.withoutIngredients.map((recipe) => (
              <Link key={recipe.id} to={`/rezepte/${recipe.id}/bearbeiten`} className="shopping-notice__link">
                Zutaten für {recipe.title} nachtragen
              </Link>
            ))}
          </>
        ) : (
          'Die Zutaten aus dem Plan sind auf der Liste.'
        ),
      )
    } catch (caught) {
      setImportError(errorMessage(caught, 'Die Übernahme hat nicht geklappt. Bitte versuche es noch einmal.'))
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    const content = shareText(list as ShoppingList, activeStore)
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: 'Einkaufsliste', text: content })
      } catch {
        // Abgebrochen: nichts zu tun.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(content)
      setNotice('Die Liste wurde in die Zwischenablage kopiert.')
    } catch {
      setSaveError('Die Liste konnte nicht kopiert werden.')
    }
  }

  function chooseStore(storeId: string) {
    const next = storeId || null
    setStoreFilter(next)
    writeStoreFilter(next)
  }

  async function itemAction(action: () => Promise<ShoppingList>) {
    setDialog(null)
    await change(action)
  }

  async function addToStaples(item: ShoppingItem) {
    setDialog(null)
    try {
      await api.createStaple(item.name)
      setNotice(`„${item.name}“ steht jetzt im Vorrat.`)
    } catch {
      setSaveError('Der Artikel konnte nicht in den Vorrat übernommen werden.')
    }
  }

  return (
    <div className="page shopping-page">
      <div className="page-header">
        <h1>Einkauf</h1>
      </div>

      <form className="shopping-add no-print" onSubmit={add}>
        <label className="visually-hidden" htmlFor="shopping-add">
          Artikel hinzufügen
        </label>
        <input
          id="shopping-add"
          className="input"
          value={text}
          maxLength={200}
          autoComplete="off"
          placeholder="Artikel hinzufügen, z. B. 2 Packungen Kaffee"
          onChange={(event) => setText(event.target.value)}
        />
        {voiceAvailable && (
          <button
            type="button"
            className="button button--secondary shopping-add__voice"
            aria-label="Einkauf ansagen"
            title="Einkauf ansagen"
            onClick={() => setDialog({ kind: 'voice' })}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.59a6 6 0 0 0 5-5.91Z"
              />
            </svg>
          </button>
        )}
        <button type="submit" className="button" disabled={!text.trim()}>
          Hinzufügen
        </button>
      </form>

      <div className="shopping-actions no-print">
        <button type="button" className="button button--secondary button--small" onClick={() => setDialog({ kind: 'import' })}>
          Aus dem Plan
        </button>
        <Link to="/einkauf/vorrat" className="button button--secondary button--small">
          Vorrat prüfen
        </Link>
        <button type="button" className="button button--secondary button--small" onClick={share} disabled={visible.length === 0}>
          Teilen
        </button>
        <button type="button" className="button button--secondary button--small" onClick={() => window.print()}>
          Drucken
        </button>
        <button
          type="button"
          className="button button--secondary button--small"
          disabled={!hasChecked}
          onClick={() => change(() => api.clearCheckedShoppingItems())}
        >
          Erledigte entfernen
        </button>
      </div>

      {list.stores.length > 0 && (
        <div className="shopping-filter no-print">
          <label className="form__label" htmlFor="shopping-store">
            Geschäft
          </label>
          <select id="shopping-store" className="select" value={activeStore ?? ''} onChange={(e) => chooseStore(e.target.value)}>
            <option value="">Alle Geschäfte</option>
            {list.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {saveError && (
        <p className="form__error" role="alert">
          {saveError}
        </p>
      )}

      {list.items.length === 0 ? (
        <div className="shopping-empty">
          <p>Die Einkaufsliste ist leer.</p>
          <div className="action-list">
            <button type="button" className="button" onClick={() => setDialog({ kind: 'import' })}>
              Aus dem Plan übernehmen
            </button>
            <Link to="/einkauf/vorrat" className="button button--secondary">
              Vorrat prüfen
            </Link>
          </div>
        </div>
      ) : (
        groupByCategory(list, visible).map(({ category, items }) => (
          <section key={category.id} className="shopping-category" aria-labelledby={`cat-${category.id}`}>
            <h2 id={`cat-${category.id}`} className="shopping-category__title">
              {category.name}
            </h2>
            <ul className="shopping-items">
              {items.map((item) => (
                <li key={item.id} className={`shopping-item${item.checked ? ' shopping-item--checked' : ''}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.checked}
                    className="shopping-item__toggle"
                    onClick={() => toggle(item)}
                  >
                    <span className="shopping-item__box" aria-hidden="true">
                      {item.checked ? '✓' : ''}
                    </span>
                    <span className="shopping-item__name">{item.name}</span>
                    {item.display && <span className="shopping-item__amount">{item.display}</span>}
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--quiet"
                    aria-label={`Details zu ${item.name}`}
                    onClick={() => setDialog({ kind: 'item', id: item.id })}
                  >
                    ⋯
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {dialog?.kind === 'import' && (
        <ImportFromPlanDialog
          today={today}
          busy={busy}
          error={importError}
          onImport={runImport}
          onClose={() => {
            setDialog(null)
            setImportError(null)
          }}
        />
      )}
      {dialog?.kind === 'voice' && (
        <ShoppingVoiceDialog
          onAdded={(next) => {
            apply(next)
            setDialog(null)
            setSaveError(null)
            setNotice('Die angesagten Artikel sind auf der Liste.')
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {openItem && (
        <ShoppingItemDialog
          item={openItem}
          list={list}
          onSave={(patch: ShoppingItemPatch) => itemAction(() => api.updateShoppingItem(openItem.id, patch))}
          onMerge={(targetId) => itemAction(() => api.mergeShoppingItem(openItem.id, targetId))}
          onAddToStaples={() => addToStaples(openItem)}
          onDelete={() => itemAction(() => api.deleteShoppingItem(openItem.id))}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
