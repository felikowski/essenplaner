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

  it('stellt das Farbschema nur für dieses Gerät um', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const update = vi.spyOn(api, 'updateSettings')
    const { user } = renderApp('/einstellungen', api)

    expect(await screen.findByRole('radio', { name: 'Wie das Gerät' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Dunkel' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('essenplaner.theme')).toBe('dark')

    await user.click(screen.getByRole('radio', { name: 'Wie das Gerät' }))
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('essenplaner.theme')).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  it('zeigt das gemerkte Farbschema an', async () => {
    localStorage.setItem('essenplaner.theme', 'light')
    renderApp('/einstellungen', new MockPlannerApi(loadMockFiles))
    expect(await screen.findByRole('radio', { name: 'Hell' })).toBeChecked()
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

describe('Einstellungen der Einkaufsliste', () => {
  it('benennt Kategorien um, legt sie an, sortiert und löscht sie', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const { user } = renderApp('/einstellungen', api)

    const drinks = await screen.findByRole('textbox', { name: 'Kategorie Getränke' })
    await user.click(screen.getByRole('button', { name: 'Getränke nach oben' }))
    await vi.waitFor(async () => expect((await api.getShoppingList())?.categories[10].name).toBe('Getränke'))

    await user.clear(drinks)
    await user.type(drinks, 'Trinken{Enter}')
    await vi.waitFor(async () => expect((await api.getShoppingList())?.categories[10].name).toBe('Trinken'))

    await user.type(screen.getByRole('textbox', { name: 'Neue Kategorie' }), 'Käsetheke{Enter}')
    expect(await screen.findByRole('textbox', { name: 'Kategorie Käsetheke' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Käsetheke löschen' }))
    await vi.waitFor(() => expect(screen.queryByRole('textbox', { name: 'Kategorie Käsetheke' })).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Sonstiges löschen' })).not.toBeInTheDocument()
  })

  it('verwaltet Geschäfte und gemerkte Zusammenführungen', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.addShoppingItem('Zwiebel')
    const list = await api.addShoppingItem('Zwiebeln')
    await api.mergeShoppingItem(list.items[0].id, list.items[1].id)
    const { user } = renderApp('/einstellungen', api)

    await user.type(await screen.findByRole('textbox', { name: 'Neues Geschäft' }), 'Wochenmarkt{Enter}')
    expect(await screen.findByRole('textbox', { name: 'Geschäft Wochenmarkt' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Wochenmarkt löschen' }))
    await vi.waitFor(() => expect(screen.queryByRole('textbox', { name: 'Geschäft Wochenmarkt' })).not.toBeInTheDocument())

    expect(screen.getByText('Zwiebel → Zwiebeln')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zusammenführung Zwiebel entfernen' }))
    expect(await screen.findByText(/Noch keine/)).toBeInTheDocument()
    expect(await api.listShoppingAliases()).toEqual([])
  })
})

describe('Tag-Verwaltung', () => {
  it('führt einen Tag beim Umbenennen in einen vorhandenen zusammen und löscht ihn', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.updateRecipeOrganization('haehnchen-curry', { tags: ['veggie'] })
    const { user } = renderApp('/einstellungen', api)

    const veggie = await screen.findByRole('textbox', { name: 'Tag veggie' })
    await user.clear(veggie)
    await user.type(veggie, 'vegetarisch{Enter}')
    await vi.waitFor(() => expect(screen.queryByRole('textbox', { name: 'Tag veggie' })).not.toBeInTheDocument())
    expect((await api.listTags()).filter((tag) => tag.name.toLocaleLowerCase('de') === 'vegetarisch')).toEqual([{ name: 'vegetarisch', count: 4 }])

    await user.click(screen.getByRole('button', { name: 'Tag vegetarisch löschen' }))
    await vi.waitFor(() => expect(screen.queryByRole('textbox', { name: 'Tag vegetarisch' })).not.toBeInTheDocument())
  })
})
