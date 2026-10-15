import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles } from '../test/mockData'
import { renderApp } from '../test/renderApp'

describe('Was habe ich da?', () => {
  it('sortiert Rezepte mit zwei Treffern vor einem Treffer und zeigt gefundene sowie fehlende Zutaten', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.addShoppingItem('Schafskäse')
    const list = await api.addShoppingItem('Feta')
    await api.mergeShoppingItem(list.items.find((item) => item.name === 'Schafskäse')!.id, list.items.find((item) => item.name === 'Feta')!.id)
    const { user } = renderApp('/rezepte/zutaten', api)

    await user.type(await screen.findByLabelText('Vorhandene Zutaten'), 'Zucchini, Schafskäse, Paprika')
    await user.click(screen.getByRole('button', { name: 'Rezepte finden' }))

    const results = screen.getByRole('list')
    const first = within(results).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('Ofengemüse mit Feta')
    expect(first).toHaveTextContent('Zucchini ✓ · Schafskäse ✓ · Paprika ✓')
    const curry = within(results).getByRole('link', { name: /Hähnchen-Curry/ })
    expect(curry).toHaveTextContent('Fehlt: Zucchini, Schafskäse')
  })

  it('zeigt eine eindeutige Meldung ohne Treffer', async () => {
    const { user } = renderApp('/rezepte/zutaten')
    await user.type(await screen.findByLabelText('Vorhandene Zutaten'), 'Trüffel')
    await user.click(screen.getByRole('button', { name: 'Rezepte finden' }))
    expect(screen.getByText('Kein Rezept mit diesen Zutaten')).toBeInTheDocument()
  })
})
