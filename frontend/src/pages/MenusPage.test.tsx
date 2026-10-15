import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles } from '../test/mockData'
import { currentUrl, renderApp } from '../test/renderApp'

afterEach(() => vi.restoreAllMocks())

describe('Menüs', () => {
  it('listet Menüs alphabetisch mit Tagen und Rezepten', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const fall = await api.createMenu({ name: 'Herbstwoche', days: 7 })
    const guest = await api.createMenu({ name: 'Gäste-Wochenende', days: 2 })
    for (let index = 0; index < 6; index++) await api.createMenuEntry(fall.id, { day: 1, meal: 'dinner', kind: 'recipe', recipeId: 'linsensuppe' })
    for (let index = 0; index < 4; index++) await api.createMenuEntry(guest.id, { day: 1, meal: 'dinner', kind: 'recipe', recipeId: 'pfannkuchen' })

    renderApp('/menues', api)

    const links = await screen.findAllByRole('link', { name: /Tage ·/ })
    expect(links.map((link) => link.textContent)).toEqual(['Gäste-Wochenende2 Tage · 4 Rezepte', 'Herbstwoche7 Tage · 6 Rezepte'])
  })

  it('erklärt die leere Ansicht und bietet ein neues Menü an', async () => {
    renderApp('/menues', new MockPlannerApi(loadMockFiles))
    expect(await screen.findByText(/Noch keine Menüs/)).toHaveTextContent('Als Menü speichern')
    expect(screen.getByLabelText('Neues Menü')).toBeInTheDocument()
  })

  it('speichert die angezeigte Woche als Menü', async () => {
    const { user } = renderApp('/woche/2026-W40', new MockPlannerApi(loadMockFiles))
    await user.click(await screen.findByRole('button', { name: 'Als Menü speichern' }))
    await user.type(screen.getByLabelText('Name'), 'Herbstwoche')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('heading', { name: 'Herbstwoche' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tag 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tag 6' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tag 7' })).not.toBeInTheDocument()
    expect(currentUrl()).toMatch(/^\/menues\/menu-/)
  })

  it('legt für einen leeren Zeitraum kein Menü an', async () => {
    const { user } = renderApp('/woche/2026-W50', new MockPlannerApi(loadMockFiles))
    await user.click(await screen.findByRole('button', { name: 'Als Menü speichern' }))
    await user.type(screen.getByLabelText('Name'), 'Leer')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('keine Einträge')
  })

  it('entfernt einen Tag und rückt die folgenden Tage auf', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const menu = await api.createMenu({ name: 'Sieben Tage', days: 7 })
    for (let day = 3; day <= 7; day++) await api.createMenuEntry(menu.id, { day, meal: 'dinner', kind: 'note', text: `Alt ${day}` })
    const { user } = renderApp(`/menues/${menu.id}`, api)

    const buttons = await screen.findAllByRole('button', { name: 'Tag entfernen' })
    await user.click(buttons[2])

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Tag 7' })).not.toBeInTheDocument())
    const dayThree = screen.getByRole('heading', { name: 'Tag 3' }).closest('li')!
    expect(within(dayThree).getByText('Alt 4')).toBeInTheDocument()
    const daySix = screen.getByRole('heading', { name: 'Tag 6' }).closest('li')!
    expect(within(daySix).getByText('Alt 7')).toBeInTheDocument()
  })

  it('fügt einen Menüeintrag hinzu und verschiebt ihn über das gemeinsame Ziel-Interface', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const menu = await api.createMenu({ name: 'Bearbeiten', days: 2 })
    const { user } = renderApp(`/menues/${menu.id}`, api)
    await user.click(await screen.findByRole('button', { name: 'Tag 1 Abendessen: hinzufügen' }))
    await user.click(screen.getByRole('tab', { name: 'Notiz' }))
    await user.type(screen.getByLabelText('Notiz'), 'Gäste kommen')
    await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
    await user.click(await screen.findByRole('button', { name: 'Gäste kommen: Optionen' }))
    await user.click(screen.getByRole('button', { name: 'Verschieben' }))
    await user.click(screen.getByRole('button', { name: 'Tag 2' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verschieben' }))

    const second = screen.getByRole('heading', { name: 'Tag 2' }).closest('li')!
    expect(await within(second).findByText('Gäste kommen')).toBeInTheDocument()
  })

  it('zeigt einen verständlichen Fehler für einen doppelten Namen', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.createMenu({ name: 'Herbstwoche' })
    const { user } = renderApp('/menues', api)
    await user.type(await screen.findByLabelText('Neues Menü'), 'herbstwoche')
    await user.click(screen.getByRole('button', { name: 'Anlegen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ein Menü mit diesem Namen gibt es schon')
  })

  it('löscht ein Menü, ohne seinen eingeplanten Plan zu ändern', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const menu = await api.createMenu({ name: 'Kurz' })
    await api.createMenuEntry(menu.id, { day: 1, meal: 'dinner', kind: 'note', text: 'Bleibt im Plan' })
    await api.applyMenu(menu.id, '2026-10-12')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderApp(`/menues/${menu.id}`, api)
    await user.click(await screen.findByRole('button', { name: 'Menü löschen' }))

    await waitFor(() => expect(currentUrl()).toBe('/menues'))
    expect((await api.getWeek('2026-W42')).days['2026-10-12'][0].text).toBe('Bleibt im Plan')
  })

  it('plant sieben Tage ab Montag ein und springt in KW 42', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const menu = await api.createMenu({ name: 'Herbstwoche', days: 7 })
    await api.createMenuEntry(menu.id, { day: 1, meal: 'dinner', kind: 'note', text: 'Montag aus Menü' })
    await api.createMenuEntry(menu.id, { day: 7, meal: 'dinner', kind: 'note', text: 'Sonntag aus Menü' })
    const { user } = renderApp(`/menues/${menu.id}`, api)
    await user.click(await screen.findByRole('button', { name: 'Einplanen' }))
    await user.clear(screen.getByLabelText('Startdatum'))
    await user.type(screen.getByLabelText('Startdatum'), '2026-10-12')
    expect(screen.getByText(/12\.10\.2026.*18\.10\.2026/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Menü einplanen' }))

    await waitFor(() => expect(currentUrl()).toBe('/woche/2026-W42'))
    expect(await screen.findByText('Montag aus Menü')).toBeInTheDocument()
    expect(screen.getByText('Sonntag aus Menü')).toBeInTheDocument()
  })

  it('hängt Menüeinträge an einen bereits belegten Tag an', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.createEntry({ date: '2026-10-12', meal: 'dinner', kind: 'note', text: 'Schon da' })
    const menu = await api.createMenu({ name: 'Dazu' })
    await api.createMenuEntry(menu.id, { day: 1, meal: 'dinner', kind: 'note', text: 'Aus dem Menü' })
    const { user } = renderApp(`/menues/${menu.id}`, api)
    await user.click(await screen.findByRole('button', { name: 'Einplanen' }))
    await user.clear(screen.getByLabelText('Startdatum'))
    await user.type(screen.getByLabelText('Startdatum'), '2026-10-12')
    await user.click(screen.getByRole('button', { name: 'Menü einplanen' }))

    const monday = (await screen.findByRole('heading', { name: 'Montag' })).closest('li')!
    const entries = within(monday).getAllByText(/Schon da|Aus dem Menü/)
    expect(entries.map((entry) => entry.textContent)).toEqual(['Schon da', 'Aus dem Menü'])
  })

  it('kennzeichnet und überspringt ein nicht mehr verfügbares Rezept', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const recipe = await api.importRecipe('https://example.com/rezepte/gemueselasagne')
    const menu = await api.createMenu({ name: 'Mit Lasagne' })
    await api.createMenuEntry(menu.id, { day: 1, meal: 'dinner', kind: 'recipe', recipeId: recipe.id })
    await api.removeRecipe(recipe.id)
    const { user } = renderApp(`/menues/${menu.id}`, api)

    expect(await screen.findByText('Nicht mehr verfügbar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Einplanen' }))
    await user.clear(screen.getByLabelText('Startdatum'))
    await user.type(screen.getByLabelText('Startdatum'), '2026-10-12')
    await user.click(screen.getByRole('button', { name: 'Menü einplanen' }))
    expect(await screen.findByRole('status')).toHaveTextContent(`Übersprungen: ${recipe.title}`)
  })

  it('zeigt ein unbekanntes Menü als nicht gefunden', async () => {
    renderApp('/menues/gibt-es-nicht', new MockPlannerApi(loadMockFiles))
    expect(await screen.findByRole('heading', { name: 'Menü nicht gefunden' })).toBeInTheDocument()
  })
})
