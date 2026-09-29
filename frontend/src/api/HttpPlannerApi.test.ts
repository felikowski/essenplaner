import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpPlannerApi } from './HttpPlannerApi'

const week = {
  week: '2026-W40',
  days: {
    '2026-09-28': null,
    '2026-09-29': null,
    '2026-09-30': 'haehnchen-curry',
    '2026-10-01': null,
    '2026-10-02': null,
    '2026-10-03': null,
    '2026-10-04': null,
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

  it('setzt und entfernt einen Tag über PUT /api/days/{date}', async () => {
    const api = new HttpPlannerApi()
    fetchMock.mockImplementation(async () => jsonResponse(week))

    await api.setDay('2026-09-30', 'haehnchen-curry')
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/days/2026-09-30',
      expect.objectContaining({ method: 'PUT', body: '{"recipeId":"haehnchen-curry"}' }),
    )

    await api.setDay('2026-09-30', null)
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/days/2026-09-30',
      expect.objectContaining({ method: 'PUT', body: '{"recipeId":null}' }),
    )
  })

  it('wirft bei Fehlerstatus, damit die Ansicht eine Meldung zeigen kann', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'unknown recipeId' }, 422))

    await expect(new HttpPlannerApi().setDay('2026-09-30', 'x')).rejects.toThrow('PUT /api/days/2026-09-30 fehlgeschlagen: 422')
  })
})
