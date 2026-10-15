import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release(): Promise<void>
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

/**
 * Hält den Bildschirm an, solange die Komponente angezeigt wird. Der Browser gibt die Sperre frei, wenn die Seite
 * unsichtbar wird; beim Zurückkehren wird sie neu angefordert. Ohne Unterstützung passiert nichts.
 */
export function useWakeLock() {
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
    if (!wakeLock) return
    let sentinel: WakeLockSentinelLike | null = null
    let active = true

    const request = () => {
      if (document.visibilityState !== 'visible') return
      wakeLock.request('screen').then(
        (acquired) => {
          if (active) sentinel = acquired
          else void acquired.release()
        },
        () => {
          // Abgelehnt (z. B. Energiesparmodus): ohne Meldung weiter.
        },
      )
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', request)
      void sentinel?.release().catch(() => {})
    }
  }, [])
}
