import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles } from '../test/mockData'
import { renderApp } from '../test/renderApp'

describe('Einstellungen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ist über die Navigation erreichbar und blendet Mahlzeiten im Plan ein', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const { user } = renderApp('/woche/2026-W40', api)

    await user.click(await screen.findByRole('link', { name: 'Einstellungen' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeInTheDocument()
    const dinner = screen.getByRole('checkbox', { name: 'Abendessen' })
    await vi.waitFor(() => expect(dinner).toBeChecked())

    await user.click(screen.getByRole('checkbox', { name: 'Mittagessen' }))
    await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mittagessen' })).toBeChecked())
    expect(await api.getSettings()).toEqual({ visibleMeals: ['lunch', 'dinner'] })

    await user.click(screen.getByRole('link', { name: 'Woche' }))
    const monday = (await screen.findByRole('heading', { level: 2, name: 'Montag' })).closest('li') as HTMLElement
    expect(within(monday).getByRole('heading', { level: 3, name: 'Mittagessen' })).toBeInTheDocument()
  })

  it('verhindert, dass alle Mahlzeiten abgewählt werden', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const update = vi.spyOn(api, 'updateSettings')
    const { user } = renderApp('/einstellungen', api)

    const dinner = await screen.findByRole('checkbox', { name: 'Abendessen' })
    await user.click(dinner)

    expect(screen.getByText('Mindestens eine Mahlzeit muss sichtbar bleiben.')).toBeInTheDocument()
    expect(dinner).toBeChecked()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('Planungsverlauf im Rezept', () => {
  it('zeigt, wann ein Rezept zuletzt und wie oft es geplant war', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.createEntry({ date: '2026-10-16', meal: 'dinner', kind: 'recipe', recipeId: 'linsensuppe' })
    const { user } = renderApp('/rezepte/linsensuppe', api)

    const summary = await screen.findByText('Zuletzt geplant: Fr 16.10.2026 · insgesamt 2-mal')
    await user.click(summary)
    expect(screen.getByRole('link', { name: 'Do 01.10.2026' })).toHaveAttribute('href', '/woche/2026-W40')
  })

  it('meldet Rezepte, die noch nie geplant waren', async () => {
    renderApp('/rezepte/haehnchen-curry', new MockPlannerApi(async (file) => (file === 'weeks.json' ? [] : loadMockFiles(file))))
    expect(await screen.findByText('Noch nie geplant')).toBeInTheDocument()
  })
})
