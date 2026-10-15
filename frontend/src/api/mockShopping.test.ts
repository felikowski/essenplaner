import { describe, expect, it } from 'vitest'
import { loadMockFiles } from '../test/mockData'
import { MockPlannerApi } from './MockPlannerApi'
import { formatAmounts, sumAmounts } from './mockShopping'

describe('Einkaufsliste im MockPlannerApi', () => {
  it('fasst Mengen wie das Backend zusammen', () => {
    expect(formatAmounts(sumAmounts([{ quantity: 800, unit: 'g' }, { quantity: 1, unit: 'kg' }]))).toBe('1,8 kg')
    expect(formatAmounts(sumAmounts([{ quantity: 250, unit: 'g' }, { quantity: 2, unit: 'EL' }]))).toBe('250 g + 2 EL')
    expect(formatAmounts(sumAmounts([{ quantity: (250 * 8) / 6, unit: 'g' }]))).toBe('333 g')
    expect(formatAmounts(sumAmounts([{ quantity: 1.2 }]))).toBe('2')
    expect(formatAmounts(sumAmounts([{ quantity: 1.5, unit: 'EL' }]))).toBe('1½ EL')
    expect(formatAmounts(sumAmounts([{}]))).toBe('')
  })

  it('übernimmt den Plan mit Faktor, überspringt Reste und Übernommenes und meldet Rezepte ohne Zutaten', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const [week] = await api.createEntry({ date: '2026-10-12', meal: 'dinner', kind: 'recipe', recipeId: 'linsensuppe', servings: 8 })
    const soup = week.days['2026-10-12'][0]
    await api.createEntry({ date: '2026-10-13', meal: 'lunch', kind: 'leftover', leftoverOf: soup.id })
    await api.createEntry({ date: '2026-10-13', meal: 'dinner', kind: 'item', text: '1 Baguette' })
    await api.createEntry({ date: '2026-10-14', meal: 'dinner', kind: 'recipe', recipeId: 'spaghetti-bolognese' })

    const result = await api.importShoppingFromPlan('2026-10-12', '2026-10-18')
    expect(result.withoutIngredients).toEqual([{ id: 'spaghetti-bolognese', title: 'Spaghetti Bolognese' }])
    const lentils = result.list.items.find((item) => item.name === 'Tellerlinsen')
    expect(lentils?.display).toBe('333 g')
    expect(result.list.items.find((item) => item.name === 'Baguette')?.display).toBe('1')

    const again = await api.importShoppingFromPlan('2026-10-12', '2026-10-18')
    expect(again.list.items).toHaveLength(result.list.items.length)
    expect(again.list.items.find((item) => item.name === 'Tellerlinsen')?.sources).toHaveLength(1)
  })

  it('liefert null, wenn sich die Liste seit der bekannten Version nicht geändert hat', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const list = await api.addShoppingItem('Milch')
    expect(await api.getShoppingList(list.version)).toBeNull()
    expect(await api.getShoppingList(list.version - 1)).toMatchObject({ version: list.version })
  })
})
