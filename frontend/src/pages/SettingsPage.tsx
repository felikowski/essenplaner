import { useState } from 'react'
import { ShoppingSettings } from '../components/ShoppingSettings'
import { MEAL_LABELS } from '../lib/meals'
import { useSettings } from '../lib/settingsContext'
import { MEALS, type Meal } from '../types'

export function SettingsPage() {
  const { settings, update } = useSettings()
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
      <h2 className="settings-heading">Einkauf</h2>
      <ShoppingSettings />
    </div>
  )
}
