/** Farbschema dieses Geräts. `system` folgt der Einstellung des Betriebssystems. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** Gleicher Schlüssel wie in `public/theme.js`, das die Wahl vor dem ersten Zeichnen anwendet. */
export const THEME_KEY = 'essenplaner.theme'

export function readTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: ThemePreference) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
}

/** Wendet das Farbschema sofort an und merkt es sich auf diesem Gerät. */
export function saveTheme(theme: ThemePreference) {
  applyTheme(theme)
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
}
