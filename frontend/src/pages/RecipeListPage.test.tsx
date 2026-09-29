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

  it('zeigt einen Hinweis, wenn keine Rezepte vorhanden sind', async () => {
    const api = new MockPlannerApi(async () => [])
    renderApp('/rezepte', api)

    expect(await screen.findByText('Noch keine Rezepte vorhanden.')).toBeInTheDocument()
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
})
