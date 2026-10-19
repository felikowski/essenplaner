import { describe, expect, it, vi } from 'vitest'
import { loadMockFiles } from '../test/mockData'
import { MOCK_TRANSCRIPT, MockPlannerApi } from './MockPlannerApi'

describe('MockPlannerApi', () => {
  it('lädt Rezepte und Wochenpläne aus den Dummy-Daten', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const recipes = await api.listRecipes()
    expect(recipes.length).toBeGreaterThanOrEqual(8)
    expect(await api.getRecipe('haehnchen-curry')).toMatchObject({ title: 'Hähnchen-Curry', servings: 4 })
    expect(await api.getRecipe('gibt-es-nicht')).toBeNull()

    const week = await api.getWeek('2026-W40')
    expect(Object.keys(week.days)).toHaveLength(7)
    expect(week.days['2026-09-30']).toMatchObject([{ kind: 'recipe', meal: 'dinner', recipeId: 'haehnchen-curry', servings: 4 }])
    expect(week.days['2026-09-29']).toEqual([])
  })

  it('legt Einträge aller Arten am Ende ihrer Mahlzeit an', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.createEntry({ date: '2026-09-30', meal: 'dinner', kind: 'note', text: ' Oma kommt ' })
    const [plan] = await api.createEntry({ date: '2026-09-30', meal: 'lunch', kind: 'item', text: '1 Baguette' })

    expect(plan.days['2026-09-30'].map((entry) => [entry.meal, entry.kind, entry.text ?? entry.recipeId])).toEqual([
      ['lunch', 'item', '1 Baguette'],
      ['dinner', 'recipe', 'haehnchen-curry'],
      ['dinner', 'note', 'Oma kommt'],
    ])
    await expect(api.createEntry({ date: '2026-09-30', meal: 'dinner', kind: 'recipe', recipeId: 'x' })).rejects.toMatchObject({
      status: 422,
    })
  })

  it('verschiebt Einträge über Wochengrenzen und liefert beide Wochen', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const id = (await api.getWeek('2026-W40')).days['2026-10-03'][0].id
    const plans = await api.updateEntry(id, { date: '2026-10-05', meal: 'lunch', servings: 8 })

    expect(plans.map((plan) => plan.week)).toEqual(['2026-W40', '2026-W41'])
    expect(plans[0].days['2026-10-03']).toEqual([])
    expect(plans[1].days['2026-10-05'][0]).toMatchObject({ id, meal: 'lunch', servings: 8 })
  })

  it('macht aus Resten eine Notiz, wenn das Original entfernt wird', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const original = (await api.getWeek('2026-W40')).days['2026-09-30'][0]
    await api.createEntry({ date: '2026-10-01', meal: 'lunch', kind: 'leftover', leftoverOf: original.id })
    const plans = await api.deleteEntry(original.id)

    expect(plans[0].days['2026-10-01'][0]).toMatchObject({ kind: 'note', text: 'Reste: Hähnchen-Curry' })
  })

  it('kopiert Wochen samt Resten und zählt Übersprungenes', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const original = (await api.getWeek('2026-W40')).days['2026-09-30'][0]
    await api.createEntry({ date: '2026-10-01', meal: 'lunch', kind: 'leftover', leftoverOf: original.id })

    const { week, skipped } = await api.copyWeek('2026-W40', '2026-W42', 'append')
    expect(skipped).toBe(0)
    const copied = week.days['2026-10-14'][0]
    expect(copied.recipeId).toBe('haehnchen-curry')
    expect(week.days['2026-10-15'].find((entry) => entry.kind === 'leftover')?.leftoverOf).toEqual({
      id: copied.id,
      date: '2026-10-14',
    })
  })

  it('liefert den Verlauf ohne Reste und speichert Einstellungen', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    expect(await api.getRecipeHistory('haehnchen-curry')).toEqual(['2026-09-30'])
    expect(await api.getSettings()).toEqual({ visibleMeals: ['dinner'] })
    expect(await api.updateSettings({ visibleMeals: ['dinner', 'breakfast'] })).toEqual({
      visibleMeals: ['breakfast', 'dinner'],
    })
    await expect(api.updateSettings({ visibleMeals: [] })).rejects.toMatchObject({ status: 422 })
  })

  it('gibt Kopien heraus, damit Aufrufer den Speicher nicht verändern', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const week = await api.getWeek('2026-W40')
    week.days['2026-09-30'] = []
    expect((await api.getWeek('2026-W40')).days['2026-09-30']).toHaveLength(1)
  })

  it('versucht es nach einem Ladefehler erneut', async () => {
    const load = vi.fn(loadMockFiles).mockRejectedValueOnce(new Error('offline'))
    const api = new MockPlannerApi(load)
    await expect(api.listRecipes()).rejects.toThrow('offline')
    expect((await api.listRecipes()).length).toBeGreaterThan(0)
  })

  it('importiert Rezepte, erkennt Duplikate und entfernt sie wieder', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const imported = await api.importRecipe('https://example.com/rezepte/kuerbis-suppe')
    expect(imported).toMatchObject({ title: 'Kuerbis suppe', removable: true })
    expect((await api.importRecipe('https://example.com/rezepte/kuerbis-suppe')).id).toBe(imported.id)

    await api.removeRecipe(imported.id)
    expect((await api.listRecipes()).some((recipe) => recipe.id === imported.id)).toBe(false)
    expect(await api.getRecipe(imported.id)).toMatchObject({ available: false })
    await expect(api.removeRecipe('gemueselasagne')).rejects.toMatchObject({ status: 409 })
    await expect(api.importRecipe('https://example.com/keine-rezeptdaten')).rejects.toMatchObject({ status: 422 })
  })

  it('ändert nur übergebene Einordnungsfelder und entfernt doppelte Tags', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const recipe = await api.updateRecipeOrganization('haehnchen-curry', { rating: 5, tags: ['Schnell', 'schnell'] })
    expect(recipe).toMatchObject({ rating: 5, course: 'Hauptgericht', tags: ['Schnell'] })
    await expect(api.updateRecipeOrganization('haehnchen-curry', { totalMinutes: 1441 })).rejects.toMatchObject({ status: 422, field: 'totalMinutes' })
  })

  it('listet Tags, führt sie zusammen und löscht sie', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.updateRecipeOrganization('haehnchen-curry', { tags: ['veggie'] })
    expect(await api.renameTag('veggie', 'vegetarisch')).toContainEqual({ name: 'vegetarisch', count: 4 })
    expect((await api.deleteTag('vegetarisch')).some((tag) => tag.name.toLocaleLowerCase('de') === 'vegetarisch')).toBe(false)
  })

  it('speichert, bearbeitet und plant Menüs wie das Backend', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const menu = await api.createMenu({ name: 'Herbstwoche', from: '2026-09-28', to: '2026-10-04' })
    expect(menu.days).toBe(6)
    expect((await api.listMenus())[0]).toMatchObject({ name: 'Herbstwoche', days: 6 })
    await expect(api.createMenu({ name: 'herbstwoche' })).rejects.toMatchObject({ status: 422 })

    const withDay = await api.appendMenuDay(menu.id)
    const withNote = await api.createMenuEntry(menu.id, { day: withDay.days, meal: 'lunch', kind: 'note', text: 'Anreise' })
    const note = withNote.entries[withDay.days][0]
    expect((await api.updateMenuEntry(menu.id, note.id, { day: 1 })).entries[1]).toContainEqual(expect.objectContaining({ text: 'Anreise' }))
    expect((await api.removeMenuDay(menu.id, 2)).days).toBe(6)

    const result = await api.applyMenu(menu.id, '2026-10-12')
    expect(result.weeks.map((plan) => plan.week)).toContain('2026-W42')
    await api.deleteMenu(menu.id)
    expect(await api.getMenu(menu.id)).toBeNull()
  })

  it('zerlegt Ansagen deterministisch und fügt Zeilen gesammelt hinzu', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.addShoppingItem('Bier')

    const spoken = await api.parseShoppingVoice('zwei Gurken, Feta, noch Bier und Spülmittel')
    expect(spoken.lines.map((line) => line.text)).toEqual(['2 Gurken', 'Feta', 'Bier', 'Spülmittel'])
    expect(spoken.lines[1]).toMatchObject({ category: 'Käse', mergesInto: null })
    expect(spoken.lines[2]).toMatchObject({ mergesInto: 'Bier' })
    expect((await api.parseShoppingVoice(new Blob(['x']))).transcript).toBe(MOCK_TRANSCRIPT)

    const pasted = await api.parseShoppingVoice('500g Hack\nTomaten (Dose)\nParmesan')
    expect(pasted.lines.map((line) => line.text)).toEqual(['500 g Hack', 'Tomaten (Dose)', 'Parmesan'])
    await expect(api.parseShoppingVoice('äh. ')).resolves.toBeDefined()
    await expect(api.parseShoppingVoice('   ')).rejects.toMatchObject({ status: 422 })
    await expect(api.parseShoppingVoice(',,')).rejects.toMatchObject({ serverMessage: 'Ich habe nichts zum Einkaufen herausgehört.' })

    const version = (await api.getShoppingList())!.version
    expect(await api.previewShoppingLines(['Rum'])).toMatchObject([{ text: 'Rum', mergesInto: null }])
    expect((await api.getShoppingList())!.version).toBe(version)
    await expect(api.addShoppingItems(['Rum', ''])).rejects.toMatchObject({ status: 422 })
    const list = await api.addShoppingItems(['Rum', '2 Bier'])
    expect(list.version).toBe(version + 1)
    expect(list.items.map((item) => [item.name, item.display])).toEqual(expect.arrayContaining([['Rum', undefined], ['Bier', '2']]))
  })
})
