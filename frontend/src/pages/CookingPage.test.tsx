import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles, mockRecipes } from '../test/mockData'
import { currentUrl, renderApp } from '../test/renderApp'

function apiWithButtermilk() {
  return new MockPlannerApi(async (file) => file === 'recipes.json' ? [
    ...(structuredClone(mockRecipes) as unknown[]),
    {
      id: 'waffeln',
      title: 'Waffeln',
      source: { kind: 'manual' },
      servings: 4,
      ingredients: ['200 ml Buttermilch', '2 Eier'],
      instructions: ['Alles verrühren.', '5–7 Minuten backen.'],
    },
  ] : loadMockFiles(file))
}

describe('Kochansicht', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock')
    vi.restoreAllMocks()
  })

  it('wechselt im Schritt-Modus per Wischgeste, Knöpfen und Pfeiltasten', async () => {
    renderApp('/rezepte/haehnchen-curry/kochen')
    expect(await screen.findByRole('heading', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
    await screen.findByText('Dieser Browser kann den Bildschirm nicht automatisch eingeschaltet lassen.')
    fireEvent.click(screen.getByRole('button', { name: 'Schritt für Schritt' }))
    expect(screen.getByText('Schritt 1 von 5')).toBeInTheDocument()

    const stepMode = screen.getByText('Schritt 1 von 5').closest('section')!
    fireEvent.pointerDown(stepMode, { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(stepMode, { clientX: 100, clientY: 105 })
    expect(screen.getByText('Schritt 2 von 5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByText('Schritt 3 von 5')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(screen.getByText('Schritt 4 von 5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Zutaten' }))
    expect(screen.getByRole('dialog', { name: 'Zutaten' })).toHaveTextContent('1 Zwiebel')
  })

  it('hakt Zutaten und Schritte nur in der aktuellen Kochsitzung ab', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen')
    const onion = await screen.findByRole('checkbox', { name: /1 Zwiebel/ })
    await user.click(onion)
    expect(onion).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('checkbox', { name: 'Schritt 1 erledigt' }))
    expect(screen.getByRole('checkbox', { name: 'Schritt 1 erledigt' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('link', { name: /Zum Rezept/ }))
    await user.click(await screen.findByRole('link', { name: 'Kochen' }))
    expect(await screen.findByRole('checkbox', { name: /1 Zwiebel/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('übernimmt abweichende Portionen aus einem Planeintrag', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.createEntry({ date: '2026-10-15', meal: 'dinner', kind: 'recipe', recipeId: 'haehnchen-curry', servings: 8 })
    const { user } = renderApp('/woche/2026-W42', api)
    await user.click(await screen.findByRole('link', { name: 'Hähnchen-Curry' }))
    expect(currentUrl()).toBe('/rezepte/haehnchen-curry?portionen=8')
    await user.click(screen.getByRole('link', { name: 'Kochen' }))
    expect(currentUrl()).toBe('/rezepte/haehnchen-curry/kochen?portionen=8')
    expect(await screen.findByRole('heading', { name: '8 Portionen' })).toBeInTheDocument()
    expect(screen.getByText('1,2 kg Hähnchenbrust')).toBeInTheDocument()
  })

  it('startet einen benannten Timer aus einem Schritt', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen')
    await user.click(await screen.findByRole('button', { name: 'Timer über 10 Minuten starten' }))
    const timer = screen.getByText('Hähnchen-Curry · Schritt 5').closest('li')!
    expect(timer).toHaveTextContent('Hähnchen-Curry · Schritt 5')
    expect(timer).toHaveTextContent('10:00')
  })

  it('zeigt Ersatzvorschläge in Detail- und Kochansicht', async () => {
    const { user } = renderApp('/rezepte/waffeln', apiWithButtermilk())
    await user.click(await screen.findByRole('button', { name: 'Ersatz für Buttermilch' }))
    expect(screen.getByRole('note')).toHaveTextContent('200 ml Milch + 1 EL Zitronensaft, 10 Minuten stehen lassen')

    await user.click(screen.getByRole('link', { name: 'Kochen' }))
    await user.click(await screen.findByRole('button', { name: 'Ersatz für Buttermilch' }))
    expect(screen.getByRole('note')).toHaveTextContent('200 ml Milch + 1 EL Zitronensaft, 10 Minuten stehen lassen')
  })

  it('teilt ein Rezept mit den Zutaten für die gewählten Portionen', async () => {
    const shared: ShareData[] = []
    const share = vi.fn(async (data: ShareData) => { shared.push(data) })
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    const { user } = renderApp('/rezepte/haehnchen-curry?portionen=8')
    await user.click(await screen.findByRole('button', { name: 'Teilen' }))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    const data = shared[0]!
    expect(data.title).toBe('Hähnchen-Curry')
    expect(data.text).toContain('8 Portionen')
    expect(data.text).toContain('- 1,2 kg Hähnchenbrust')
  })

  it('kopiert das Rezept ohne Teilen-Menü in die Zwischenablage', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    const { user } = renderApp('/rezepte/haehnchen-curry')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.click(await screen.findByRole('button', { name: 'Teilen' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    expect(screen.getByText('Das Rezept wurde in die Zwischenablage kopiert.')).toBeInTheDocument()
  })

  it('zeigt zwei Timer auch nach dem Wechsel zur Einkaufsliste, den kürzeren zuerst', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen')
    await user.click(await screen.findByRole('button', { name: 'Timer über 10 Minuten starten' }))
    await user.click(screen.getByRole('button', { name: 'Timer stellen' }))
    const dialog = screen.getByRole('dialog', { name: 'Timer stellen' })
    await user.clear(within(dialog).getByLabelText('Name'))
    await user.type(within(dialog).getByLabelText('Name'), 'Backofen')
    await user.clear(within(dialog).getByLabelText('Minuten'))
    await user.type(within(dialog).getByLabelText('Minuten'), '25')
    await user.click(within(dialog).getByRole('button', { name: 'Starten' }))
    await user.click(screen.getByRole('link', { name: 'Einkauf' }))
    expect(await screen.findByRole('heading', { name: 'Einkauf' })).toBeInTheDocument()
    const timers = screen.getAllByRole('listitem').filter((item) => item.closest('.timer-list'))
    expect(timers[0]).toHaveTextContent('Hähnchen-Curry · Schritt 5')
    expect(timers[1]).toHaveTextContent('Backofen')
  })
})
