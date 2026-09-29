import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T }

interface Settled<T> {
  load: () => Promise<T>
  attempt: number
  state: AsyncState<T>
}

/**
 * Lädt Daten über `load` und lädt neu, sobald sich `load` ändert.
 * `load` muss daher mit useCallback stabil gehalten werden.
 */
export function useAsyncData<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)

  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => {
        if (!cancelled) setSettled({ load, attempt, state: { status: 'ready', data } })
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ load, attempt, state: { status: 'error', error } })
      },
    )
    return () => {
      cancelled = true
    }
  }, [load, attempt])

  // Ein Ergebnis gilt nur für den Aufruf, der es geliefert hat; sonst wird gerade geladen.
  const state: AsyncState<T> =
    settled && settled.load === load && settled.attempt === attempt ? settled.state : { status: 'loading' }

  const update = useCallback((change: (data: T) => T) => {
    setSettled((current) =>
      current?.state.status === 'ready'
        ? { ...current, state: { status: 'ready', data: change(current.state.data) } }
        : current,
    )
  }, [])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  return { state, update, retry }
}
