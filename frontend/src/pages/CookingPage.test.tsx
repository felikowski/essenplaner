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

function ingredientList() {
  return screen.getByRole('heading', { name: 'Zutaten' }).closest('section')!
}

function highlightedIngredients(container: HTMLElement) {
  return [...container.querySelectorAll('.is-highlighted [role="checkbox"]')].map((item) => item.textContent?.replace('✓', ''))
}

function stepIngredients(stepNumber: number) {
  return within(screen.getByRole('list', { name: `Zutaten für Schritt ${stepNumber}` }))
    .getAllByRole('checkbox').map((item) => item.textContent)
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

  it('hebt die Zutaten eines angetippten Schritts hervor und zeigt sie unter dem Schritt', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen')
    await user.click(await screen.findByText('Hähnchen in Würfel schneiden, Zwiebel und Knoblauch fein hacken.'))
    expect(highlightedIngredients(ingredientList())).toEqual(['600 g Hähnchenbrust', '1 Zwiebel', '2 Knoblauchzehen'])
    expect(stepIngredients(2)).toEqual(['600 g Hähnchenbrust', '1 Zwiebel', '2 Knoblauchzehen'])
    expect(screen.getByRole('button', { name: 'Zutaten für Schritt 2' })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByText('Currypulver kurz mitrösten, mit Kokosmilch ablöschen.'))
    expect(highlightedIngredients(ingredientList())).toEqual(['1 EL Currypulver', '400 ml Kokosmilch'])
    expect(screen.queryByRole('list', { name: 'Zutaten für Schritt 2' })).not.toBeInTheDocument()

    await user.click(screen.getByText('Currypulver kurz mitrösten, mit Kokosmilch ablöschen.'))
    expect(highlightedIngredients(ingredientList())).toEqual([])
    expect(screen.queryByRole('list', { name: 'Zutaten für Schritt 4' })).not.toBeInTheDocument()
  })

  it('wählt Schritte auch über den Knopf „Zutaten“ per Tastatur', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen')
    const toggle = await screen.findByRole('button', { name: 'Zutaten für Schritt 1' })
    toggle.focus()
    await user.keyboard('{Enter}')
    expect(stepIngredients(1)).toEqual(['250 g Basmatireis'])
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('zeigt die Zutaten unter dem Schritt mit den gewählten Portionen', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen?portionen=8')
    await user.click(await screen.findByText('Hähnchen in Würfel schneiden, Zwiebel und Knoblauch fein hacken.'))
    expect(stepIngredients(2)).toEqual(['1,2 kg Hähnchenbrust', '2 Zwiebel', '4 Knoblauchzehen'])
  })

  it('ändert die Auswahl nicht, wenn ein Timer im Schritt gestartet wird', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen')
    await user.click(await screen.findByRole('button', { name: 'Timer über 10 Minuten starten' }))
    expect(screen.getByText('Hähnchen-Curry · Schritt 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zutaten für Schritt 5' })).toHaveAttribute('aria-expanded', 'false')
    expect(highlightedIngredients(ingredientList())).toEqual([])
  })

  it('hakt Zutaten unter dem Schritt gemeinsam mit der Zutatenliste ab', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen')
    await user.click(await screen.findByText('Hähnchen in Würfel schneiden, Zwiebel und Knoblauch fein hacken.'))
    const step = within(screen.getByRole('list', { name: 'Zutaten für Schritt 2' }))
    await user.click(step.getByRole('checkbox', { name: '1 Zwiebel' }))
    expect(step.getByRole('checkbox', { name: '1 Zwiebel' })).toHaveAttribute('aria-checked', 'true')
    expect(within(ingredientList()).getByRole('checkbox', { name: /1 Zwiebel/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('meldet einen Schritt ohne erkannte Zutaten', async () => {
    const { user } = renderApp('/rezepte/waffeln/kochen', apiWithButtermilk())
    await user.click(await screen.findByText('Alles verrühren.'))
    expect(screen.getByText('Keine Zutaten erkannt')).toBeInTheDocument()
    expect(highlightedIngredients(ingredientList())).toEqual([])
  })

  it('zeigt im Schritt-Modus die Zutaten des aktuellen Schritts und hebt sie im Overlay hervor', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/kochen')
    await user.click(await screen.findByRole('button', { name: 'Schritt für Schritt' }))
    expect(stepIngredients(1)).toEqual(['250 g Basmatireis'])
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.getByText('Schritt 4 von 5')).toBeInTheDocument()
    expect(stepIngredients(4)).toEqual(['1 EL Currypulver', '400 ml Kokosmilch'])

    await user.click(screen.getByRole('button', { name: 'Zutaten' }))
    expect(highlightedIngredients(screen.getByRole('dialog', { name: 'Zutaten' }))).toEqual(['1 EL Currypulver', '400 ml Kokosmilch'])
  })
})
