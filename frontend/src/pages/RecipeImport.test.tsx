import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { RequestError } from '../api/request'
import { loadMockFiles } from '../test/mockData'
import { renderApp } from '../test/renderApp'

describe('Rezept per URL importieren', () => {
  it('importiert aus dem Katalog und zeigt danach das Rezept', async () => {
    const { user } = renderApp('/rezepte')

    await user.click(await screen.findByRole('button', { name: 'Rezept hinzufügen' }))
    const dialog = screen.getByRole('dialog', { name: 'Rezept hinzufügen' })
    await user.type(within(dialog).getByLabelText('Link zur Rezeptseite'), 'https://example.com/rezepte/kuerbissuppe')
    await user.click(within(dialog).getByRole('button', { name: 'Importieren' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Kuerbissuppe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Original ansehen' })).toHaveAttribute(
      'href',
      'https://example.com/rezepte/kuerbissuppe',
    )
  })

  it('zeigt während des Imports einen Ladezustand', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    let finish: () => void = () => {}
    vi.spyOn(api, 'importRecipe').mockImplementation(
      () => new Promise((resolve) => (finish = () => resolve({ id: 'pfannkuchen', title: 'Pfannkuchen', source: { kind: 'pdf', pdfUrl: '/x.pdf' } }))),
    )
    const { user } = renderApp('/rezepte', api)

    await user.click(await screen.findByRole('button', { name: 'Rezept hinzufügen' }))
    await user.type(screen.getByLabelText('Link zur Rezeptseite'), 'https://example.com/a')
    await user.click(screen.getByRole('button', { name: 'Importieren' }))

    expect(screen.getByRole('button', { name: 'Wird importiert …' })).toBeDisabled()
    finish()
    expect(await screen.findByRole('heading', { level: 1, name: 'Pfannkuchen' })).toBeInTheDocument()
  })

  it('zeigt Fehler im Dialog und behält die URL', async () => {
    const { user } = renderApp('/rezepte')

    await user.click(await screen.findByRole('button', { name: 'Rezept hinzufügen' }))
    const input = screen.getByLabelText('Link zur Rezeptseite')
    await user.type(input, 'https://example.com/keine-rezeptdaten')
    await user.click(screen.getByRole('button', { name: 'Importieren' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Auf dieser Seite wurden keine Rezeptdaten gefunden.')
    expect(input).toHaveValue('https://example.com/keine-rezeptdaten')
    expect(screen.getByRole('button', { name: 'Importieren' })).toBeEnabled()
  })

  it('zeigt bei Serverfehlern eine allgemeine Meldung', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    vi.spyOn(api, 'importRecipe').mockRejectedValue(new RequestError('x', 500, 'internal error'))
    const { user } = renderApp('/rezepte', api)

    await user.click(await screen.findByRole('button', { name: 'Rezept hinzufügen' }))
    await user.type(screen.getByLabelText('Link zur Rezeptseite'), 'https://example.com/a')
    await user.click(screen.getByRole('button', { name: 'Importieren' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Der Import hat nicht geklappt.')
  })
})

describe('Importiertes Rezept entfernen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('entfernt nach Rückfrage; im Plan bleibt es mit Hinweis sichtbar', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const imported = await api.importRecipe('https://example.com/rezepte/gulasch')
    await api.createEntry({ date: '2026-09-29', meal: 'dinner', kind: 'recipe', recipeId: imported.id })
    const { user } = renderApp(`/rezepte/${imported.id}`, api)

    await user.click(await screen.findByRole('button', { name: 'Rezept entfernen' }))
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await user.click(screen.getByRole('button', { name: 'Rezept entfernen' }))
    await user.click(screen.getByRole('button', { name: 'Endgültig entfernen' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Rezepte' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Gulasch/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Woche' }))
    const tuesday = (await screen.findByRole('heading', { name: 'Dienstag' })).closest('li') as HTMLElement
    expect(await within(tuesday).findByRole('link', { name: 'Gulasch' })).toBeInTheDocument()
    expect(within(tuesday).getByText('Nicht mehr verfügbar')).toBeInTheDocument()

    await user.click(within(tuesday).getByRole('link', { name: 'Gulasch' }))
    expect(await screen.findByText(/Nicht mehr verfügbar\. Das Rezept steht nur noch/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rezept entfernen' })).not.toBeInTheDocument()
  })

  it('bietet Entfernen nur für entfernbare Rezepte an', async () => {
    renderApp('/rezepte/haehnchen-curry')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hähnchen-Curry' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rezept entfernen' })).not.toBeInTheDocument()
  })
})
