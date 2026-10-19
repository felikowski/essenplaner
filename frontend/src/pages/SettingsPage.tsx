import { useState } from 'react'
import { ShoppingSettings } from '../components/ShoppingSettings'
import { TagSettings } from '../components/TagSettings'
import { MEAL_LABELS } from '../lib/meals'
import { useSettings } from '../lib/settingsContext'
import { readTheme, saveTheme, type ThemePreference } from '../lib/theme'
import { MEALS, type Meal } from '../types'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Wie das Gerät' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
]

export function SettingsPage() {
  const { settings, update } = useSettings()
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState(readTheme)

  function chooseTheme(next: ThemePreference) {
    saveTheme(next)
    setTheme(next)
  }

  async function toggle(meal: Meal, checked: boolean) {
    setHint(null)
    setError(null)
    const next = checked
      ? MEALS.filter((candidate) => candidate === meal || settings.visibleMeals.includes(candidate))
      : settings.visibleMeals.filter((candidate) => candidate !== meal)
    if (next.length === 0) {
      setHint('Mindestens eine Mahlzeit muss sichtbar bleiben.')
      return
    }
    setSaving(true)
    try {
      await update({ visibleMeals: next })
    } catch {
      setError('Die Einstellung konnte nicht gespeichert werden. Bitte versuche es noch einmal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page settings-page">
      <h1>Einstellungen</h1>
      <p className="status">Diese Einstellungen gelten für alle im Haushalt.</p>
      <fieldset className="settings-group">
        <legend className="form__label">Mahlzeiten im Wochenplan</legend>
        <p className="form__hint">Einträge ausgeblendeter Mahlzeiten bleiben erhalten und erscheinen wieder, sobald du die Mahlzeit einblendest.</p>
        {MEALS.map((meal) => (
          <label key={meal} className="checkbox">
            <input
              type="checkbox"
              checked={settings.visibleMeals.includes(meal)}
              disabled={saving}
              onChange={(event) => toggle(meal, event.target.checked)}
            />
            {MEAL_LABELS[meal]}
          </label>
        ))}
        {hint && (
          <p className="notice" role="status">
            {hint}
          </p>
        )}
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
      </fieldset>
      <h2 className="settings-heading">Rezepte</h2>
      <TagSettings />
      <h2 className="settings-heading">Einkauf</h2>
      <ShoppingSettings />
      <h2 className="settings-heading">Darstellung</h2>
      <fieldset className="settings-group">
        <legend className="form__label">Farbschema</legend>
        <p className="form__hint">Gilt nur auf diesem Gerät.</p>
        {THEME_OPTIONS.map((option) => (
          <label key={option.value} className="checkbox">
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={theme === option.value}
              onChange={() => chooseTheme(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
