import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Recipe } from '../types'
import { RecipePicker } from './RecipePicker'

const recipes: Recipe[] = [
  { id: 'b', title: 'Linsensuppe', source: { kind: 'web', url: 'https://example.com/linsen' } },
  { id: 'a', title: 'Hähnchen-Curry', source: { kind: 'web', url: 'https://example.com/curry' } },
  { id: 'c', title: 'Kichererbsen-Curry', source: { kind: 'pdf', pdfUrl: '/curry.pdf' } },
]

function renderPicker(selectedId: string | null = null) {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <RecipePicker recipes={recipes} dayLabel="Montag" selectedId={selectedId} onSelect={onSelect} onClose={onClose} />,
  )
  return { onSelect, onClose, user: userEvent.setup() }
}

describe('RecipePicker', () => {
  it('listet Rezepte alphabetisch mit Quellenart', () => {
    renderPicker()

    const items = within(screen.getByRole('dialog', { name: 'Rezept für Montag' })).getAllByRole('button', {
      name: /Curry|suppe/,
    })
    expect(items.map((item) => item.textContent)).toEqual([
      'Hähnchen-CurryWebseite',
      'Kichererbsen-CurryPDF',
      'LinsensuppeWebseite',
    ])
  })

  it('meldet das gewählte Rezept', async () => {
    const { user, onSelect } = renderPicker()

    await user.click(screen.getByRole('button', { name: /Linsensuppe/ }))

    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('filtert per Suche ohne Beachtung der Groß- und Kleinschreibung', async () => {
    const { user } = renderPicker()

    await user.type(screen.getByRole('searchbox', { name: 'Rezepte durchsuchen' }), 'CURRY')

    expect(screen.getByRole('button', { name: /Hähnchen-Curry/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kichererbsen-Curry/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Linsensuppe/ })).not.toBeInTheDocument()
  })

  it('zeigt „Keine Rezepte gefunden“, wenn nichts passt', async () => {
    const { user } = renderPicker()

    await user.type(screen.getByRole('searchbox'), 'Pizza')

    expect(screen.getByText('Keine Rezepte gefunden')).toBeInTheDocument()
  })

  it('bietet „Kein Gericht“ nur für belegte Tage an', () => {
    renderPicker(null)
    expect(screen.queryByRole('button', { name: 'Kein Gericht' })).not.toBeInTheDocument()
  })

  it('meldet null bei „Kein Gericht“', async () => {
    const { user, onSelect } = renderPicker('a')

    expect(screen.getByRole('button', { name: /Hähnchen-Curry/ })).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: 'Kein Gericht' }))

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('schließt über „Abbrechen“, Escape und Tippen neben den Dialog, ohne etwas auszuwählen', async () => {
    const { user, onClose, onSelect } = renderPicker('a')

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('dialog').parentElement as HTMLElement)

    expect(onClose).toHaveBeenCalledTimes(3)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
