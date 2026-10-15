import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpPlannerApi } from './HttpPlannerApi'

const week = {
  week: '2026-W40',
  days: {
    '2026-09-28': [],
    '2026-09-29': [],
    '2026-09-30': [{ id: 'e-1', meal: 'dinner', position: 1, kind: 'recipe', recipeId: 'haehnchen-curry', servings: 4 }],
    '2026-10-01': [],
    '2026-10-02': [],
    '2026-10-03': [],
    '2026-10-04': [],
  },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('HttpPlannerApi', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('lädt Rezepte über GET /api/recipes', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'a', title: 'A', source: { kind: 'pdf', pdfUrl: '/a.pdf' } }]))

    const recipes = await new HttpPlannerApi().listRecipes()

    expect(fetchMock).toHaveBeenCalledWith('/api/recipes', expect.anything())
    expect(recipes).toHaveLength(1)
  })

  it('lädt ein Rezept und liefert null bei 404', async () => {
    const api = new HttpPlannerApi()
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'a b', title: 'A', source: { kind: 'web', url: 'x' } }))
    expect(await api.getRecipe('a b')).toMatchObject({ title: 'A' })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/recipes/a%20b', expect.anything())

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'recipe not found' }, 404))
    expect(await api.getRecipe('fehlt')).toBeNull()
  })

  it('meldet andere Fehler beim Rezeptabruf weiter', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'internal error' }, 500))

    await expect(new HttpPlannerApi().getRecipe('a')).rejects.toThrow('500')
  })

  it('lädt eine Woche über GET /api/weeks/{week}', async () => {
    fetchMock.mockResolvedValue(jsonResponse(week))

    expect(await new HttpPlannerApi().getWeek('2026-W40')).toEqual(week)
    expect(fetchMock).toHaveBeenCalledWith('/api/weeks/2026-W40', expect.anything())
  })

  it('legt Einträge an, ändert und löscht sie und liefert die betroffenen Wochen', async () => {
    const api = new HttpPlannerApi()
    fetchMock.mockImplementation(async () => jsonResponse({ weeks: [week] }))

    expect(await api.createEntry({ date: '2026-09-30', meal: 'dinner', kind: 'note', text: 'Oma kommt' })).toEqual([week])
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/entries',
      expect.objectContaining({ method: 'POST', body: '{"date":"2026-09-30","meal":"dinner","kind":"note","text":"Oma kommt"}' }),
    )
    await api.updateEntry('e 1', { servings: null })
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/entries/e%201',
      expect.objectContaining({ method: 'PATCH', body: '{"servings":null}' }),
    )
    await api.deleteEntry('e-1')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/entries/e-1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('kopiert Wochen, liest den Verlauf und die Einstellungen', async () => {
    const api = new HttpPlannerApi()
    fetchMock.mockResolvedValueOnce(jsonResponse({ week, skipped: 1 }))
    expect(await api.copyWeek('2026-W40', '2026-W42', 'replace')).toEqual({ week, skipped: 1 })
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/weeks/2026-W40/copy',
      expect.objectContaining({ method: 'POST', body: '{"to":"2026-W42","mode":"replace"}' }),
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ dates: ['2026-10-16'] }))
    expect(await api.getRecipeHistory('linsensuppe')).toEqual(['2026-10-16'])

    fetchMock.mockResolvedValueOnce(jsonResponse({ visibleMeals: ['lunch', 'dinner'] }))
    expect(await api.updateSettings({ visibleMeals: ['dinner', 'lunch'] })).toEqual({ visibleMeals: ['lunch', 'dinner'] })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/settings', expect.objectContaining({ method: 'PATCH' }))
  })

  it('importiert über POST /api/recipes/import und entfernt über DELETE', async () => {
    const api = new HttpPlannerApi()
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'w-1', title: 'Kürbissuppe', source: { kind: 'web', url: 'x' } }, 201))
    expect(await api.importRecipe('https://example.com/k')).toMatchObject({ id: 'w-1' })
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/recipes/import',
      expect.objectContaining({ method: 'POST', body: '{"url":"https://example.com/k"}' }),
    )

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(api.removeRecipe('w 1')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/recipes/w%201', expect.objectContaining({ method: 'DELETE' }))
  })

  it('reicht die Fehlermeldung des Servers weiter', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Auf dieser Seite wurden keine Rezeptdaten gefunden.' }, 422))
    await expect(new HttpPlannerApi().importRecipe('https://example.com')).rejects.toMatchObject({
      status: 422,
      serverMessage: 'Auf dieser Seite wurden keine Rezeptdaten gefunden.',
    })
  })

  it('wirft bei Fehlerstatus, damit die Ansicht eine Meldung zeigen kann', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'unknown recipeId' }, 422))

    await expect(
      new HttpPlannerApi().createEntry({ date: '2026-09-30', meal: 'dinner', kind: 'recipe', recipeId: 'x' }),
    ).rejects.toThrow('POST /api/entries fehlgeschlagen: 422')
  })

  it('fragt die Einkaufsliste mit der bekannten Version nach und liefert null bei 304', async () => {
    const api = new HttpPlannerApi()
    const list = { version: 3, categories: [], stores: [], items: [] }
    fetchMock.mockResolvedValueOnce(jsonResponse(list))
    expect(await api.getShoppingList()).toEqual(list)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/list', { headers: {} })

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }))
    expect(await api.getShoppingList(3)).toBeNull()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/list', { headers: { 'If-None-Match': '"v3"' } })

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'internal error' }, 500))
    await expect(api.getShoppingList()).rejects.toThrow('500')
  })

  it('schickt Änderungen an der Einkaufsliste an /api/shopping', async () => {
    const api = new HttpPlannerApi()
    const list = { version: 4, categories: [], stores: [], items: [] }
    fetchMock.mockImplementation(async () => jsonResponse(list))

    await api.addShoppingItem('2 Packungen Kaffee')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/items', expect.objectContaining({ method: 'POST', body: '{"text":"2 Packungen Kaffee"}' }))
    await api.setShoppingItemChecked('s 1', true)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/items/s%201/checked', expect.objectContaining({ method: 'PUT', body: '{"checked":true}' }))
    await api.updateShoppingItem('s-1', { storeId: null })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/items/s-1', expect.objectContaining({ method: 'PATCH', body: '{"storeId":null}' }))
    await api.mergeShoppingItem('s-1', 's-2')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/items/s-1/merge-into/s-2', expect.objectContaining({ method: 'POST' }))
    await api.importShoppingFromPlan('2026-10-01', '2026-10-07')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/import', expect.objectContaining({ body: '{"from":"2026-10-01","to":"2026-10-07"}' }))
    await api.reorderShoppingCategories(['a', 'b'])
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/categories/order', expect.objectContaining({ method: 'PUT', body: '{"ids":["a","b"]}' }))
    await api.deleteShoppingAlias('zwiebel')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/aliases/zwiebel', expect.objectContaining({ method: 'DELETE' }))
    await api.addStaplesToList(['st-1'])
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/staples/add', expect.objectContaining({ body: '{"ids":["st-1"]}' }))
  })
})
