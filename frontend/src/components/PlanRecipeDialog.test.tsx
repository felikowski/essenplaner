import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlannerApiContext } from '../api/context'
import type { PlannerApi } from '../api/PlannerApi'
import { SettingsContext } from '../lib/settingsContext'
import type { Meal, Recipe } from '../types'
import { PlanRecipeDialog } from './PlanRecipeDialog'

const soup: Recipe = { id: 'linsensuppe', title: 'Linsensuppe', source: { kind: 'manual' }, servings: 6 }

function setup({
  recipe = soup,
  initialServings,
  visibleMeals = ['dinner'],
  createEntry = vi.fn().mockResolvedValue([]),
}: {
  recipe?: Recipe
  initialServings?: number
  visibleMeals?: Meal[]
  createEntry?: ReturnType<typeof vi.fn>
} = {}) {
  const user = userEvent.setup()
  const onPlanned = vi.fn()
  const onClose = vi.fn()
  const api = { createEntry } as unknown as PlannerApi
  render(
    <PlannerApiContext value={api}>
      <SettingsContext value={{ settings: { visibleMeals }, update: async () => {} }}>
        <PlanRecipeDialog recipe={recipe} initialServings={initialServings} onPlanned={onPlanned} onClose={onClose} />
      </SettingsContext>
    </PlannerApiContext>,
  )
  return { user, createEntry, onPlanned, onClose }
}

function dayChips() {
  return within(screen.getByRole('group', { name: 'Tag' })).getAllByRole('button')
}

describe('Dialog „Einplanen“', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 21, 12, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('startet in der aktuellen Woche mit heute, Abendessen und den Rezeptportionen', async () => {
    const { user, createEntry, onPlanned } = setup()

    expect(screen.getByRole('heading', { name: 'Einplanen: Linsensuppe' })).toBeInTheDocument()
    expect(screen.getByText('KW 43 · 2026')).toBeInTheDocument()
    expect(dayChips().map((chip) => chip.textContent)).toEqual([
      'Mo 19.10.',
      'Di 20.10.',
      'Mi 21.10.',
      'Do 22.10.',
      'Fr 23.10.',
      'Sa 24.10.',
      'So 25.10.',
    ])
    expect(screen.getByRole('button', { name: 'Mi 21.10.' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('Mahlzeit')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Portionen' })).toHaveTextContent('6')

    await user.click(screen.getByRole('button', { name: 'Einplanen' }))
    expect(createEntry).toHaveBeenCalledWith({ date: '2026-10-21', meal: 'dinner', kind: 'recipe', recipeId: 'linsensuppe', servings: 6 })
    expect(onPlanned).toHaveBeenCalledWith('2026-10-21', 'dinner')
  })

  it('blättert zur nächsten Woche und plant dort den Montag ein', async () => {
    const { user, createEntry } = setup()
    await user.click(screen.getByRole('button', { name: 'Nächste Woche' }))
    expect(screen.getByText('KW 44 · 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mo 26.10.' }))
    expect(screen.getByRole('button', { name: 'Mo 26.10.' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Vorige Woche' }))
    await user.click(screen.getByRole('button', { name: 'Vorige Woche' }))
    expect(screen.getByText('KW 42 · 2026')).toBeInTheDocument()
    expect(dayChips().every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Einplanen' }))
    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-26' }))
  })

  it('springt beim Datumsfeld zur Woche des Datums', async () => {
    const { user, createEntry } = setup()
    const input = screen.getByLabelText('Anderes Datum')
    await user.clear(input)
    await user.type(input, '2026-12-24')
    expect(screen.getByText('KW 52 · 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Do 24.12.' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Einplanen' }))
    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-12-24' }))
  })

  it('bietet nur sichtbare Mahlzeiten an und wählt ohne Abendessen die erste', async () => {
    const { user, createEntry } = setup({ visibleMeals: ['lunch', 'breakfast'] })
    const select = screen.getByLabelText('Mahlzeit')
    expect(select).toHaveValue('breakfast')
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['Frühstück', 'Mittagessen'])

    await user.selectOptions(select, 'lunch')
    await user.click(screen.getByRole('button', { name: 'Einplanen' }))
    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ meal: 'lunch' }))
  })

  it('übernimmt vorgegebene Portionen und lässt sie ändern', async () => {
    const { user, createEntry } = setup({ initialServings: 8 })
    const picker = screen.getByRole('group', { name: 'Portionen' })
    expect(picker).toHaveTextContent('8')
    await user.click(within(picker).getByRole('button', { name: 'Mehr Portionen' }))
    await user.click(screen.getByRole('button', { name: 'Einplanen' }))
    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ servings: 9 }))
  })

  it('plant Rezepte ohne Portionsangabe ohne Portionen ein', async () => {
    const { user, createEntry } = setup({ recipe: { id: 'notiz', title: 'Omas Gulasch', source: { kind: 'manual' } } })
    expect(screen.queryByRole('group', { name: 'Portionen' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Einplanen' }))
    expect(createEntry).toHaveBeenCalledWith({ date: '2026-10-21', meal: 'dinner', kind: 'recipe', recipeId: 'notiz' })
  })

  it('schließt mit Abbrechen, ohne zu speichern', async () => {
    const { user, createEntry, onClose } = setup()
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onClose).toHaveBeenCalled()
    expect(createEntry).not.toHaveBeenCalled()
  })

  it('bleibt bei einem Fehler offen und behält die Auswahl', async () => {
    const createEntry = vi.fn().mockRejectedValue(new Error('offline'))
    const { user, onPlanned } = setup({ createEntry })
    await user.click(screen.getByRole('button', { name: 'Fr 23.10.' }))
    await user.click(screen.getByRole('button', { name: 'Einplanen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Das Rezept konnte nicht eingeplant werden.')
    expect(onPlanned).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Fr 23.10.' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Einplanen' })).toBeEnabled()
  })
})
