import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'

describe('Rezeptdetail', () => {
  it('zeigt alle Angaben eines Webrezepts und verlinkt das Original in einem neuen Tab', async () => {
    renderApp('/rezepte/haehnchen-curry')

    expect(await screen.findByRole('heading', { level: 1, name: 'Hähnchen-Curry' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Hähnchen-Curry' })).toHaveAttribute(
      'src',
      '/mock/images/haehnchen-curry.svg',
    )
    expect(screen.getByText('4 Portionen')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zutaten' })).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: 'Zutaten' })).toBeInTheDocument()
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
    expect(screen.queryByRole('heading', { name: 'Zutaten' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Zubereitung' })).not.toBeInTheDocument()
  })

  it('meldet ein unbekanntes Rezept und führt zurück zur Liste', async () => {
    const { user } = renderApp('/rezepte/gibt-es-nicht')

    expect(await screen.findByRole('heading', { level: 1, name: 'Rezept nicht gefunden' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Zur Rezeptliste' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Rezepte' })).toBeInTheDocument()
  })
})
