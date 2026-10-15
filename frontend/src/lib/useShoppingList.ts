import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlannerApi } from '../api/context'
import type { ShoppingList } from '../types'

export const SHOPPING_POLL_MS = 10_000

/**
 * Hält die Einkaufsliste aktuell: lädt beim Öffnen, fragt alle 10 Sekunden nach, solange die Seite sichtbar ist,
 * und sofort, wenn sie wieder sichtbar wird. Unveränderte Listen kosten dank Version (ETag) kaum etwas.
 */
export function useShoppingList(pollMs = SHOPPING_POLL_MS) {
  const api = usePlannerApi()
  const [list, setList] = useState<ShoppingList | null>(null)
  const [error, setError] = useState<unknown>(null)
  const version = useRef<number | undefined>(undefined)

  /** Übernimmt eine Liste, wenn sie nicht älter ist als die angezeigte. */
  const apply = useCallback((next: ShoppingList) => {
    if (version.current !== undefined && next.version < version.current) return
    version.current = next.version
    setList(next)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const next = await api.getShoppingList(version.current)
      if (next) apply(next)
      setError(null)
    } catch (caught) {
      // Ein Fehler beim Nachfragen lässt die angezeigte Liste stehen; nur ohne Liste wird er gezeigt.
      if (version.current === undefined) setError(caught)
    }
  }, [api, apply])

  useEffect(() => {
    // Erst nach dem Effekt laden; refresh setzt Zustand erst, wenn die Antwort da ist.
    void Promise.resolve().then(refresh)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, pollMs)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh, pollMs])

  /** Zeigt eine Änderung sofort an, bevor der Server antwortet. */
  const patchLocal = useCallback((change: (current: ShoppingList) => ShoppingList) => {
    setList((current) => (current ? change(current) : current))
  }, [])

  const retry = useCallback(() => {
    setError(null)
    void refresh()
  }, [refresh])

  return { list, error, apply, patchLocal, refresh, retry }
}
