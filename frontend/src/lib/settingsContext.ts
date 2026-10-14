import { createContext, useContext } from 'react'
import type { HouseholdSettings } from '../types'

export interface SettingsContextValue {
  settings: HouseholdSettings
  /** Speichert Einstellungen für den ganzen Haushalt; wirft, wenn der Server sie ablehnt. */
  update: (patch: Partial<HouseholdSettings>) => Promise<void>
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings muss innerhalb von SettingsProvider verwendet werden')
  return value
}
