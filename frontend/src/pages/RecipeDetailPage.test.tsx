import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles, mockRecipes } from '../test/mockData'
import { currentUrl, renderApp } from '../test/renderApp'

// Gekürzt aus dem HelloFresh-Import „Kaspressknödel“
const helloFresh = {
  id: 'kaspressknoedel',
  title: 'Kaspressknödel',
  source: { kind: 'web', url: 'https://example.com/kaspressknoedel' },
  servings: 2,
  ingredients: ['250 g Steinofenbaguette', '½ Teelöffel Salz', '2 Esslöffel Butter'],
  instructions: [
    'Brotwürfel, 200 ml [300 ml | 400 ml] Milch*, 0,5 TL [0,75 TL | 1 TL] Salz* und Pfeffer* mischen.',
    'Aus dem Knödelteig ca. 6 [9 | 12] flache Knödel formen. Je Seite ca. 5 – 7 Min. braten.',
  ],
}

function apiWithHelloFresh() {
  return new MockPlannerApi(async (file) =>
    file === 'recipes.json' ? [...(structuredClone(mockRecipes) as unknown[]), helloFresh] : loadMockFiles(file),
  )
}

function ingredientTexts() {
  const list = screen.getByRole('heading', { name: /^Zutaten/ }).parentElement!.querySelector('ul')!
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

function stepTexts() {
  return screen.getAllByRole('listitem').filter((item) => item.closest('ol')).map((item) => item.textContent)
}

describe('Rezeptdetail', () => {
  it('zeigt alle Angaben eines Webrezepts und verlinkt das Original in einem neuen Tab', async () => {
    renderApp('/rezepte/haehnchen-curry')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hähnchen-Curry' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Hähnchen-Curry' })).toHaveAttribute(
      'src',
      '/mock/images/haehnchen-curry.svg',
    )
    expect(screen.getByText('4 Portionen')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zutaten für 4 Portionen' })).toBeInTheDocument()
    expect(screen.getByText('400 ml Kokosmilch')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zubereitung' })).toBeInTheDocument()

    const original = screen.getByRole('link', { name: 'Original ansehen' })
    expect(original).toHaveAttribute('href', 'https://example.com/rezepte/haehnchen-curry')
    expect(original).toHaveAttribute('target', '_blank')
    expect(original).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('blendet fehlende Angaben aus', async () => {
    renderApp('/rezepte/linsensuppe')

    expect(await screen.findByRole('heading', { level: 1, name: 'Linsensuppe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zutaten für 6 Portionen' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Zubereitung' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('zeigt für ein PDF-Rezept den Titel und einen Link „PDF öffnen“', async () => {
    renderApp('/rezepte/gemueselasagne')

    expect(await screen.findByRole('heading', { level: 1, name: 'Gemüselasagne' })).toBeInTheDocument()
    const pdf = screen.getByRole('link', { name: 'PDF öffnen' })
    expect(pdf).toHaveAttribute('href', '/mock/pdf/beispielrezept.pdf')
    expect(pdf).toHaveAttribute('target', '_blank')
    expect(screen.queryByRole('link', { name: 'Original ansehen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^Zutaten/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Zubereitung' })).not.toBeInTheDocument()
  })

  it('meldet ein unbekanntes Rezept und führt zurück zur Liste', async () => {
    const { user } = renderApp('/rezepte/gibt-es-nicht')

    expect(await screen.findByRole('heading', { level: 1, name: 'Rezept nicht gefunden' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Zur Rezeptliste' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Rezepte' })).toBeInTheDocument()
  })

  describe('Portionen umrechnen', () => {
    it('rechnet mit „+“ um und schreibt die Portionen in die Adresse', async () => {
      const { user } = renderApp('/rezepte/haehnchen-curry')

      await screen.findByRole('heading', { name: 'Zutaten für 4 Portionen' })
      expect(ingredientTexts()).toContain('600 g Hähnchenbrust')
      for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Mehr Portionen' }))

      expect(screen.getByRole('heading', { name: 'Zutaten für 8 Portionen' })).toBeInTheDocument()
      expect(ingredientTexts()).toEqual(expect.arrayContaining(['1,2 kg Hähnchenbrust', '2 EL Currypulver', 'Salz und Pfeffer']))
      expect(currentUrl()).toBe('/rezepte/haehnchen-curry?portionen=8')

      await user.click(screen.getByRole('button', { name: 'Rezept: 4' }))
      expect(screen.getByRole('heading', { name: 'Zutaten für 4 Portionen' })).toBeInTheDocument()
      expect(ingredientTexts()).toContain('600 g Hähnchenbrust')
      expect(currentUrl()).toBe('/rezepte/haehnchen-curry')
    })

    it('übernimmt die Portionen aus der Adresse', async () => {
      renderApp('/rezepte/haehnchen-curry?portionen=2')

      expect(await screen.findByRole('heading', { name: 'Zutaten für 2 Portionen' })).toBeInTheDocument()
      expect(ingredientTexts()).toEqual(expect.arrayContaining(['300 g Hähnchenbrust', '½ EL Currypulver', '½ Zwiebel']))
    })

    it.each(['0', '100', 'acht', '2.5'])('ignoriert den ungültigen Parameter „%s“', async (value) => {
      renderApp(`/rezepte/haehnchen-curry?portionen=${value}`)

      expect(await screen.findByRole('heading', { name: 'Zutaten für 4 Portionen' })).toBeInTheDocument()
    })

    it('begrenzt die Auswahl auf 1 bis 99', async () => {
      renderApp('/rezepte/haehnchen-curry?portionen=1')

      expect(await screen.findByRole('button', { name: 'Weniger Portionen' })).toBeDisabled()
    })

    it('bietet ohne Rezeptportionen keine Auswahl an', async () => {
      const api = new MockPlannerApi(loadMockFiles)
      const recipe = await api.createRecipe({ title: 'Brotzeit', servings: null, ingredients: ['2 Brezen'], instructions: [] })
      renderApp(`/rezepte/${recipe.id}?portionen=4`, api)

      expect(await screen.findByRole('heading', { name: 'Zutaten' })).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Portionen' })).not.toBeInTheDocument()
      expect(ingredientTexts()).toEqual(['2 Brezen'])
    })

    it('zeigt in HelloFresh-Schritten ohne Auswahl nur die Grundmenge', async () => {
      renderApp('/rezepte/kaspressknoedel', apiWithHelloFresh())

      await screen.findByRole('heading', { name: 'Zutaten für 2 Portionen' })
      expect(stepTexts()).toEqual([
        'Brotwürfel, 200 ml Milch*, 0,5 TL Salz* und Pfeffer* mischen.',
        'Aus dem Knödelteig ca. 6 flache Knödel formen. Je Seite ca. 5 – 7 Min. braten.',
      ])
    })

    it('wählt in HelloFresh-Schritten die passende Variante', async () => {
      renderApp('/rezepte/kaspressknoedel?portionen=3', apiWithHelloFresh())

      await screen.findByRole('heading', { name: 'Zutaten für 3 Portionen' })
      expect(ingredientTexts()).toEqual(['375 g Steinofenbaguette', '¾ TL Salz', '3 EL Butter'])
      expect(stepTexts()).toEqual([
        'Brotwürfel, 300 ml Milch*, 0,75 TL Salz* und Pfeffer* mischen.',
        'Aus dem Knödelteig ca. 9 flache Knödel formen. Je Seite ca. 5 – 7 Min. braten.',
      ])
      expect(document.querySelector('.scaled-amount')).toBeNull()
    })

    it('rechnet ohne passende Variante um und kennzeichnet das', async () => {
      renderApp('/rezepte/kaspressknoedel?portionen=6', apiWithHelloFresh())

      await screen.findByRole('heading', { name: 'Zutaten für 6 Portionen' })
      expect(stepTexts()[0]).toBe('Brotwürfel, 600 ml Milch*, 1½ TL Salz* und Pfeffer* mischen.')
      const milk = screen.getByText('600 ml')
      expect(milk.tagName).toBe('EM')
      expect(milk).toHaveAttribute('title', 'umgerechnet aus 200 ml für 2 Portionen')
    })
  })
})
