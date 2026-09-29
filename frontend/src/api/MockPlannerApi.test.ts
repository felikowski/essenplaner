import { describe, expect, it, vi } from 'vitest'
import { loadMockFiles } from '../test/mockData'
import { MockPlannerApi } from './MockPlannerApi'

describe('MockPlannerApi', () => {
  it('lädt Rezepte und Wochenpläne aus den Dummy-Daten', async () => {
    const api = new MockPlannerApi(loadMockFiles)

    const recipes = await api.listRecipes()
    expect(recipes.length).toBeGreaterThanOrEqual(8)
    expect(await api.getRecipe('haehnchen-curry')).toMatchObject({ title: 'Hähnchen-Curry' })
    expect(await api.getRecipe('gibt-es-nicht')).toBeNull()

    const week = await api.getWeek('2026-W40')
    expect(Object.keys(week.days)).toHaveLength(7)
    expect(week.days['2026-09-30']).toBe('haehnchen-curry')
  })

  it('liefert für Wochen ohne Plan sieben leere Tage', async () => {
    const api = new MockPlannerApi(loadMockFiles)

    const week = await api.getWeek('2027-W01')
    expect(week).toEqual({
      week: '2027-W01',
      days: {
        '2027-01-04': null,
        '2027-01-05': null,
        '2027-01-06': null,
        '2027-01-07': null,
        '2027-01-08': null,
        '2027-01-09': null,
        '2027-01-10': null,
      },
    })
  })

  it('ordnet mit setDay ein Rezept zu und ersetzt ein vorhandenes', async () => {
    const api = new MockPlannerApi(loadMockFiles)

    const added = await api.setDay('2026-09-29', 'pfannkuchen')
    expect(added.days['2026-09-29']).toBe('pfannkuchen')

    const replaced = await api.setDay('2026-09-29', 'linsensuppe')
    expect(replaced.days['2026-09-29']).toBe('linsensuppe')
    expect((await api.getWeek('2026-W40')).days['2026-09-29']).toBe('linsensuppe')
  })

  it('legt beim Zuordnen einen Plan für eine neue Woche an', async () => {
    const api = new MockPlannerApi(loadMockFiles)

    const plan = await api.setDay('2027-01-03', 'pfannkuchen')
    expect(plan.week).toBe('2026-W53')
    expect(Object.keys(plan.days)).toHaveLength(7)
    expect((await api.getWeek('2026-W53')).days['2027-01-03']).toBe('pfannkuchen')
  })

  it('entfernt eine Zuordnung mit setDay(null)', async () => {
    const api = new MockPlannerApi(loadMockFiles)

    const plan = await api.setDay('2026-09-30', null)
    expect(plan.days['2026-09-30']).toBeNull()
    expect((await api.getWeek('2026-W40')).days['2026-09-30']).toBeNull()
  })

  it('lehnt unbekannte Rezepte ab und lässt den Plan unverändert', async () => {
    const api = new MockPlannerApi(loadMockFiles)

    await expect(api.setDay('2026-09-30', 'gibt-es-nicht')).rejects.toThrow()
    expect((await api.getWeek('2026-W40')).days['2026-09-30']).toBe('haehnchen-curry')
  })

  it('gibt Kopien heraus, damit Aufrufer den Speicher nicht verändern', async () => {
    const api = new MockPlannerApi(loadMockFiles)

    const week = await api.getWeek('2026-W40')
    week.days['2026-09-30'] = null
    expect((await api.getWeek('2026-W40')).days['2026-09-30']).toBe('haehnchen-curry')
  })

  it('versucht es nach einem Ladefehler erneut', async () => {
    const load = vi.fn(loadMockFiles).mockRejectedValueOnce(new Error('offline'))
    const api = new MockPlannerApi(load)

    await expect(api.listRecipes()).rejects.toThrow('offline')
    expect((await api.listRecipes()).length).toBeGreaterThan(0)
  })
})
