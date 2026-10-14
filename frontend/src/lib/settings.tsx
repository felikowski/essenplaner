import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePlannerApi } from '../api/context'
import type { HouseholdSettings } from '../types'
import { SettingsContext } from './settingsContext'

const DEFAULT_SETTINGS: HouseholdSettings = { visibleMeals: ['dinner'] }

/** Lädt die Haushalts-Einstellungen einmal beim Start. Bis dahin gelten die Standardwerte. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const api = usePlannerApi()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    let cancelled = false
    api.getSettings().then(
      (loaded) => {
        if (!cancelled) setSettings(loaded)
      },
      () => {
        // Ohne Einstellungen bleiben die Standardwerte; die Seiten zeigen eigene Ladefehler.
      },
    )
    return () => {
      cancelled = true
    }
  }, [api])

  const update = useCallback(
    async (patch: Partial<HouseholdSettings>) => {
      setSettings(await api.updateSettings(patch))
    },
    [api],
  )

  return <SettingsContext value={{ settings, update }}>{children}</SettingsContext>
}
