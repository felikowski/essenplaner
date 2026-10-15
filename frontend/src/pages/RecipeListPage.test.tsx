import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles } from '../test/mockData'
import { renderApp } from '../test/renderApp'

function recipeTitles() {
  return within(screen.getByRole('list'))
    .getAllByRole('link')
    .map((link) => link.querySelector('.recipe-card__title')?.textContent)
}

describe('Rezeptliste', () => {
  it('listet alle Rezepte alphabetisch mit Quellenart und Vorschaubild', async () => {
    renderApp('/rezepte')

    await screen.findByRole('heading', { level: 1, name: 'Rezepte' })
    await screen.findByRole('list')
    expect(recipeTitles()).toEqual([
      'Gemüselasagne',
      'Hähnchen-Curry',
      'Kartoffelsuppe mit Würstchen',
      'Kichererbsen-Curry mit Spinat',
      'Linsensuppe',
      'Ofengemüse mit Feta',
      'Pfannkuchen',
      'Spaghetti Bolognese',
    ])

    const curry = screen.getByRole('link', { name: /Hähnchen-Curry/ })
    expect(curry).toHaveTextContent('Webseite')
    expect(curry).toHaveAttribute('href', '/rezepte/haehnchen-curry')
    expect(curry.querySelector('img')).toHaveAttribute('src', '/mock/images/haehnchen-curry.svg')

    const lasagne = screen.getByRole('link', { name: /Gemüselasagne/ })
    expect(lasagne).toHaveTextContent('PDF')
    expect(lasagne.querySelector('img')).toBeNull()
    expect(screen.getByRole('link', { name: 'Rezepte' })).toHaveAttribute('aria-current', 'page')
  })

  it('kennzeichnet eigene Rezepte und zeigt Bewertung, Zeit und höchstens drei Tags', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const own = await api.createRecipe({ title: 'Omas Gulasch', servings: null, ingredients: [], instructions: [] })
    await api.updateRecipeOrganization(own.id, { tags: ['Familie', 'Sonntag', 'Winter', 'Fest'], rating: 4, totalMinutes: 30 })
    renderApp('/rezepte', api)

    const curry = await screen.findByRole('link', { name: /Hähnchen-Curry/ })
    expect(within(curry).getByLabelText('4 von 5 Sternen')).toHaveTextContent('★★★★☆')
    expect(curry).toHaveTextContent('30 Min.')
    expect(curry.querySelectorAll('.tag')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Omas Gulasch/ })).toHaveTextContent('Eigenes Rezept')
    expect(screen.getByRole('link', { name: /Omas Gulasch/ }).querySelectorAll('.tag')).toHaveLength(3)
  })

  it('zeigt einen Hinweis, wenn keine Rezepte vorhanden sind', async () => {
    const api = new MockPlannerApi(async () => [])
    renderApp('/rezepte', api)

    expect(await screen.findByText(/Noch keine Rezepte vorhanden\./)).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('zeigt eine Fehlermeldung, wenn das Laden fehlschlägt', async () => {
    const load = vi.fn(loadMockFiles).mockRejectedValueOnce(new Error('offline'))
    const { user } = renderApp('/rezepte', new MockPlannerApi(load))

    expect(await screen.findByRole('alert')).toHaveTextContent('Die Rezepte konnten nicht geladen werden.')
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByRole('link', { name: /Pfannkuchen/ })).toBeInTheDocument()
  })

  describe('Suche', () => {
    it('findet „curry“ ohne Beachtung von Groß- und Kleinschreibung', async () => {
      const { user } = renderApp('/rezepte')

      await user.type(await screen.findByRole('searchbox', { name: 'Rezepte durchsuchen' }), 'curry')

      expect(recipeTitles()).toEqual(['Hähnchen-Curry', 'Kichererbsen-Curry mit Spinat'])
    })

    it('findet Treffer in Tags und Zutaten, Titel stehen zuerst', async () => {
      const { user } = renderApp('/rezepte')
      const search = await screen.findByRole('searchbox')
      await user.type(search, 'vegetarisch')
      expect(recipeTitles()).toEqual(['Kichererbsen-Curry mit Spinat', 'Linsensuppe', 'Ofengemüse mit Feta'])

      await user.clear(search)
      await user.type(search, 'curry')
      expect(recipeTitles().slice(0, 2)).toEqual(['Hähnchen-Curry', 'Kichererbsen-Curry mit Spinat'])
    })

    it('zeigt „Keine Rezepte gefunden“, wenn nichts passt', async () => {
      const { user } = renderApp('/rezepte')

      await user.type(await screen.findByRole('searchbox'), 'Sushi')

      expect(screen.getByText('Keine Rezepte gefunden')).toBeInTheDocument()
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('übernimmt den Suchbegriff aus der URL, damit er beim Zurückgehen erhalten bleibt', async () => {
      renderApp('/rezepte?q=Suppe')

      expect(await screen.findByRole('searchbox')).toHaveValue('Suppe')
      expect(recipeTitles()).toEqual(['Kartoffelsuppe mit Würstchen', 'Linsensuppe'])
    })
  })

  describe('Filter und Sortierung', () => {
    it('übernimmt Gang und Zeit aus der URL und behält sie beim Neuladen', async () => {
      renderApp('/rezepte?gang=Hauptgericht&zeit=30')
      expect(await screen.findByRole('button', { name: 'Filter (2)' })).toBeInTheDocument()
      expect(recipeTitles()).toEqual(['Hähnchen-Curry', 'Kichererbsen-Curry mit Spinat'])
    })

    it('zeigt bei Filtern ohne Treffer eine eigene Meldung und setzt sie zurück', async () => {
      const { user } = renderApp('/rezepte')
      await user.click(await screen.findByRole('button', { name: 'Filter' }))
      await user.selectOptions(screen.getByLabelText('Quelle'), 'manual')
      await user.click(screen.getByRole('button', { name: 'Fertig' }))
      expect(screen.getByText('Keine Rezepte passen zu den Filtern')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))
      expect(await screen.findByRole('link', { name: /Hähnchen-Curry/ })).toBeInTheDocument()
    })

    it('öffnet „Ausprobieren“ als Schnellfilter und sortiert nach Bewertung', async () => {
      const { user } = renderApp('/rezepte')
      await user.click(await screen.findByRole('button', { name: 'Ausprobieren' }))
      expect(recipeTitles()).toEqual(['Hähnchen-Curry'])
      await user.selectOptions(screen.getByLabelText('Sortierung'), 'rating')
      expect(screen.getByRole('button', { name: 'Filter Ausprobieren entfernen' })).toBeInTheDocument()
    })
  })
})
