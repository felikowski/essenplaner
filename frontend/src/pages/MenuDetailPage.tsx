import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { usePlannerApi } from '../api/context'
import { AddEntryDialog } from '../components/AddEntryDialog'
import { ApplyMenuDialog } from '../components/ApplyMenuDialog'
import { DayCard } from '../components/DayCard'
import { EntryActionsDialog } from '../components/EntryActionsDialog'
import { LoadError, Loading } from '../components/Status'
import { TargetDialog } from '../components/TargetDialog'
import { entryTitle } from '../lib/entries'
import { MEAL_LABELS } from '../lib/meals'
import { parseIsoDate, weekOf } from '../lib/isoWeek'
import { useSettings } from '../lib/settingsContext'
import { useAsyncData } from '../lib/useAsyncData'
import { MEALS, type Meal, type Menu, type MenuEntry, type Recipe } from '../types'

type Dialog =
  | { kind: 'add'; day: number; meal: Meal }
  | { kind: 'actions'; entry: MenuEntry }
  | { kind: 'move'; entry: MenuEntry }
  | { kind: 'leftover'; entry: MenuEntry }
  | { kind: 'apply' }

export function MenuDetailPage() {
  const { id = '' } = useParams()
  const api = usePlannerApi()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const load = useCallback(async () => {
    const [menu, recipes] = await Promise.all([api.getMenu(id), api.listRecipes()])
    if (!menu) return null
    const missing = [...new Set(Object.values(menu.entries).flat().map((entry) => entry.recipeId).filter(Boolean))]
      .filter((recipeId) => !recipes.some((recipe) => recipe.id === recipeId))
    const loaded = await Promise.all(missing.map((recipeId) => api.getRecipe(recipeId!)))
    return { menu, recipes: [...recipes, ...loaded.filter((recipe): recipe is Recipe => recipe !== null)] }
  }, [api, id])
  const { state, update, retry } = useAsyncData(load)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const data = state.status === 'ready' ? state.data : null
  const menu = data?.menu
  const occupiedMeals = useMemo(() => menu ? Object.values(menu.entries).flat().map((entry) => entry.meal) : [], [menu])
  const visibleMeals = MEALS.filter((meal) => settings.visibleMeals.includes(meal) || occupiedMeals.includes(meal))
  const hiddenMeals = MEALS.filter((meal) => occupiedMeals.includes(meal) && !settings.visibleMeals.includes(meal))

  async function change(action: () => Promise<Menu>) {
    setBusy(true)
    setError(null)
    try {
      const changed = await action()
      update((current) => current ? { ...current, menu: changed } : current)
      setDialog(null)
    } catch {
      setError('Das Menü konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  if (state.status === 'loading') return <div className="page"><Loading /></div>
  if (state.status === 'error') return <div className="page"><LoadError message="Das Menü konnte nicht geladen werden." onRetry={retry} /></div>
  if (!data || !menu) return <div className="page"><h1>Menü nicht gefunden</h1><Link to="/menues">Zu den Menüs</Link></div>

  const allEntries = Object.values(menu.entries).flat()
  const recipes = data.recipes
  const targets = Array.from({ length: menu.days }, (_, index) => ({ kind: 'menu' as const, menuId: menu.id, day: index + 1 }))
  const recipeFor = (entry: MenuEntry) => recipes.find((recipe) => recipe.id === entry.recipeId)

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    await change(() => api.updateMenu(menu.id, { name: String(values.get('name')), description: String(values.get('description')) }))
  }

  const removeMenu = async () => {
    if (!window.confirm(`„${menu.name}“ wirklich löschen?`)) return
    await api.deleteMenu(menu.id)
    navigate('/menues', { replace: true })
  }

  return (
    <div className="page">
      <p><Link to="/menues">← Alle Menüs</Link></p>
      <h1>{menu.name}</h1>
      <form className="form menu-details" onSubmit={saveDetails}>
        <label className="form__label" htmlFor="menu-name">Name</label>
        <input id="menu-name" name="name" className="input" defaultValue={menu.name} maxLength={100} required />
        <label className="form__label" htmlFor="menu-description">Beschreibung</label>
        <textarea id="menu-description" name="description" className="textarea" defaultValue={menu.description} maxLength={500} />
        <div className="week-actions">
          <button type="submit" className="button button--secondary" disabled={busy}>Angaben speichern</button>
          <button type="button" className="button" onClick={() => setDialog({ kind: 'apply' })}>Einplanen</button>
        </div>
      </form>
      {error && <p className="alert" role="alert">{error}</p>}
      <ol className="day-list menu-days">
        {targets.map((target) => (
          <DayCard
            key={target.day}
            label={`Tag ${target.day}`}
            entries={menu.entries[target.day] ?? []}
            weekEntries={allEntries}
            visibleMeals={visibleMeals}
            recipes={recipes}
            isToday={false}
            busy={busy}
            onAdd={(meal) => setDialog({ kind: 'add', day: target.day, meal })}
            onOpenEntry={(entry) => setDialog({ kind: 'actions', entry: entry as MenuEntry })}
            headerAction={(
              <button type="button" className="text-button day-card__remove" disabled={menu.days === 1 || busy} onClick={() => change(() => api.removeMenuDay(menu.id, target.day))}>
                Tag entfernen
              </button>
            )}
          />
        ))}
      </ol>
      <div className="week-actions">
        <button type="button" className="button button--secondary" disabled={menu.days >= 28 || busy} onClick={() => change(() => api.appendMenuDay(menu.id))}>Tag anfügen</button>
        <button type="button" className="button button--danger" onClick={removeMenu}>Menü löschen</button>
      </div>

      {dialog?.kind === 'add' && (
        <AddEntryDialog
          label={`Tag ${dialog.day} · ${MEAL_LABELS[dialog.meal]}`}
          target={{ kind: 'menu', menuId: menu.id, day: dialog.day }}
          recipes={recipes.filter((recipe) => recipe.available !== false)}
          onAddRecipe={(target, recipeId) => target.kind === 'menu' && change(() => api.createMenuEntry(menu.id, { day: target.day, meal: dialog.meal, kind: 'recipe', recipeId }))}
          onAddText={(target, kind, text) => target.kind === 'menu' && change(() => api.createMenuEntry(menu.id, { day: target.day, meal: dialog.meal, kind, text }))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'actions' && (
        <EntryActionsDialog
          entry={dialog.entry}
          title={entryTitle(dialog.entry, recipeFor(dialog.entry))}
          recipe={recipeFor(dialog.entry)}
          busy={busy}
          onSetServings={(servings) => change(() => api.updateMenuEntry(menu.id, dialog.entry.id, { servings }))}
          onMove={() => setDialog({ kind: 'move', entry: dialog.entry })}
          onLeftover={() => setDialog({ kind: 'leftover', entry: dialog.entry })}
          onDelete={() => change(() => api.deleteMenuEntry(menu.id, dialog.entry.id))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'move' && (
        <TargetDialog
          title={`Verschieben: ${entryTitle(dialog.entry, recipeFor(dialog.entry))}`}
          confirmLabel="Verschieben"
          targets={targets}
          initialTarget={{ kind: 'menu', menuId: menu.id, day: dialog.entry.day }}
          initialMeal={dialog.entry.meal}
          onConfirm={(target, meal) => target.kind === 'menu' && change(() => api.updateMenuEntry(menu.id, dialog.entry.id, { day: target.day, meal }))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'leftover' && (
        <TargetDialog
          title={`Reste einplanen: ${entryTitle(dialog.entry, recipeFor(dialog.entry))}`}
          confirmLabel="Reste einplanen"
          targets={targets}
          initialTarget={{ kind: 'menu', menuId: menu.id, day: Math.min(menu.days, dialog.entry.day + 1) }}
          initialMeal={dialog.entry.meal}
          onConfirm={(target, meal) => target.kind === 'menu' && change(() => api.createMenuEntry(menu.id, { day: target.day, meal, kind: 'leftover', leftoverOf: dialog.entry.id }))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'apply' && (
        <ApplyMenuDialog
          menu={menu}
          hiddenMeals={hiddenMeals}
          onApplied={({ skipped }, start) => {
            const skippedText = skipped.length ? ` Übersprungen: ${skipped.join(', ')}` : ''
            const hiddenText = hiddenMeals.length ? ' Das Menü enthält ausgeblendete Mahlzeiten.' : ''
            navigate(`/woche/${weekOf(parseIsoDate(start))}`, { state: { text: `${menu.name} wurde eingeplant.${skippedText}${hiddenText}` } })
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
