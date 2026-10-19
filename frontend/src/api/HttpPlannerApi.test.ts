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

  it('spricht alle Menü-Endpunkte an', async () => {
    const api = new HttpPlannerApi()
    const menu = { id: 'm 1', name: 'Herbstwoche', days: 1, createdAt: '2026-10-01T00:00:00Z', entries: { 1: [] } }
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'm 1', name: 'Herbstwoche', days: 1, recipeCount: 0 }]))
    expect(await api.listMenus()).toHaveLength(1)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus', expect.anything())

    fetchMock.mockResolvedValueOnce(jsonResponse(menu))
    expect(await api.getMenu('m 1')).toEqual(menu)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201', expect.anything())
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'menu not found' }, 404))
    expect(await api.getMenu('fehlt')).toBeNull()

    fetchMock.mockResolvedValue(jsonResponse(menu, 201))
    await api.createMenu({ name: 'Herbstwoche', from: '2026-09-28', to: '2026-10-04' })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus', expect.objectContaining({ method: 'POST', body: '{"name":"Herbstwoche","from":"2026-09-28","to":"2026-10-04"}' }))

    fetchMock.mockImplementation(async () => jsonResponse(menu))
    await api.updateMenu('m 1', { name: 'Herbst', description: 'Bewährt' })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201', expect.objectContaining({ method: 'PATCH' }))
    await api.createMenuEntry('m 1', { day: 1, meal: 'dinner', kind: 'note', text: 'Oma' })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201/entries', expect.objectContaining({ method: 'POST' }))
    await api.updateMenuEntry('m 1', 'e 1', { day: 1, meal: 'lunch' })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201/entries/e%201', expect.objectContaining({ method: 'PATCH' }))
    await api.deleteMenuEntry('m 1', 'e 1')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201/entries/e%201', expect.objectContaining({ method: 'DELETE' }))
    await api.appendMenuDay('m 1')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201/days', expect.objectContaining({ method: 'POST' }))
    await api.removeMenuDay('m 1', 2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201/days/2', expect.objectContaining({ method: 'DELETE' }))

    fetchMock.mockResolvedValueOnce(jsonResponse({ weeks: [week], skipped: [] }))
    expect(await api.applyMenu('m 1', '2026-10-12')).toEqual({ weeks: [week], skipped: [] })
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201/apply', expect.objectContaining({ method: 'POST', body: '{"start":"2026-10-12"}' }))

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await api.deleteMenu('m 1')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/menus/m%201', expect.objectContaining({ method: 'DELETE' }))
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

  it('ändert die Einordnung teilweise und verwaltet Tags', async () => {
    const api = new HttpPlannerApi()
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'a', title: 'A', source: { kind: 'manual' }, rating: 5 }))
    expect(await api.updateRecipeOrganization('a b', { rating: 5 })).toMatchObject({ rating: 5 })
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/recipes/a%20b/organization',
      expect.objectContaining({ method: 'PATCH', body: '{"rating":5}' }),
    )

    fetchMock.mockResolvedValueOnce(jsonResponse([{ name: 'Schnell', count: 2 }]))
    expect(await api.listTags()).toEqual([{ name: 'Schnell', count: 2 }])
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tags', expect.anything())

    fetchMock.mockResolvedValueOnce(jsonResponse([{ name: 'Vegetarisch', count: 3 }]))
    await api.renameTag('veggie', 'Vegetarisch')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tags/veggie', expect.objectContaining({ method: 'PATCH', body: '{"name":"Vegetarisch"}' }))

    fetchMock.mockResolvedValueOnce(jsonResponse([]))
    await api.deleteTag('Sauce & Dip')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tags/Sauce%20%26%20Dip', expect.objectContaining({ method: 'DELETE' }))
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

  it('nutzt die Endpunkte der Spracheingabe', async () => {
    const api = new HttpPlannerApi()
    const line = { text: '2 Gurken', name: 'Gurken', categoryId: 'cat-obst-gemuese', category: 'Obst & Gemüse', mergesInto: null }

    fetchMock.mockResolvedValueOnce(jsonResponse({ available: true }))
    expect(await api.getVoiceAvailability()).toBe(true)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/voice', expect.anything())

    fetchMock.mockResolvedValueOnce(jsonResponse({ transcript: 'zwei Gurken', lines: [line] }))
    const audio = new Blob(['x'], { type: 'audio/mp4' })
    expect((await api.parseShoppingVoice(audio)).lines).toEqual([line])
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/shopping/voice/parse',
      expect.objectContaining({ method: 'POST', body: audio, headers: { 'Content-Type': 'audio/mp4' } }),
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ transcript: 'Feta', lines: [line] }))
    await api.parseShoppingVoice('Feta')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/voice/parse', expect.objectContaining({ body: '{"text":"Feta"}' }))

    fetchMock.mockResolvedValueOnce(jsonResponse({ lines: [line] }))
    expect(await api.previewShoppingLines(['2 Gurken'])).toEqual([line])
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/items/batch?dryRun=1', expect.objectContaining({ body: '{"texts":["2 Gurken"]}' }))

    fetchMock.mockResolvedValueOnce(jsonResponse({ version: 2, categories: [], stores: [], items: [] }))
    await api.addShoppingItems(['2 Gurken'])
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping/items/batch', expect.objectContaining({ method: 'POST', body: '{"texts":["2 Gurken"]}' }))

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Die Spracherkennung ist gerade nicht erreichbar.' }, 502))
    await expect(api.parseShoppingVoice('Feta')).rejects.toMatchObject({ status: 502, serverMessage: 'Die Spracherkennung ist gerade nicht erreichbar.' })
  })
})
