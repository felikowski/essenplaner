import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { RequestError } from '../api/request'
import { loadMockFiles } from '../test/mockData'
import { currentUrl, renderApp } from '../test/renderApp'
import { STORE_FILTER_KEY } from './ShoppingPage'

function section(name: string): HTMLElement {
  return screen.getByRole('region', { name })
}

function itemNames(region: HTMLElement): string[] {
  return within(region)
    .getAllByRole('checkbox')
    .map((box) => box.querySelector('.shopping-item__name')?.textContent ?? '')
}

describe('Einkaufsliste', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0))
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'share')
  })

  it('ist über die Navigation erreichbar und zeigt bei leerer Liste Plan und Vorrat an', async () => {
    const { user } = renderApp('/woche/2026-W40')
    await user.click(await screen.findByRole('link', { name: 'Einkauf' }))

    expect(await screen.findByText('Die Einkaufsliste ist leer.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aus dem Plan übernehmen' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Vorrat prüfen' }).length).toBeGreaterThan(0)
  })

  it('fügt Artikel hinzu und sortiert sie in Kategorien', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const { user } = renderApp('/einkauf', api)

    const input = await screen.findByRole('textbox', { name: 'Artikel hinzufügen' })
    await user.type(input, '2 Packungen Kaffee{Enter}')
    await user.type(input, 'Zucchini{Enter}')

    expect(await screen.findByRole('checkbox', { name: /Kaffee/ })).toHaveTextContent('Kaffee2 Pck.')
    expect(itemNames(section('Getränke'))).toEqual(['Kaffee'])
    expect(itemNames(section('Obst & Gemüse'))).toEqual(['Zucchini'])
    expect(input).toHaveValue('')
  })

  it('hakt Artikel sofort ab, lässt sie ans Ende rutschen und räumt erledigte auf', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.addShoppingItem('Milch')
    await api.addShoppingItem('Butter')
    const check = vi.spyOn(api, 'setShoppingItemChecked')
    const { user } = renderApp('/einkauf', api)

    const milk = await screen.findByRole('checkbox', { name: 'Milch' })
    expect(itemNames(section('Milchprodukte & Eier'))).toEqual(['Butter', 'Milch'])
    await user.click(screen.getByRole('checkbox', { name: 'Butter' }))
    expect(screen.getByRole('checkbox', { name: 'Butter' })).toBeChecked()
    expect(check).toHaveBeenCalledWith(expect.any(String), true)
    await vi.waitFor(() => expect(itemNames(section('Milchprodukte & Eier'))).toEqual(['Milch', 'Butter']))
    expect(milk).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Erledigte entfernen' }))
    await vi.waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Butter' })).not.toBeInTheDocument())
    expect(screen.getByRole('checkbox', { name: 'Milch' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erledigte entfernen' })).toBeDisabled()
  })

  it('übernimmt die nächsten sieben Tage aus dem Plan und nennt Rezepte ohne Zutaten', async () => {
    // Nach den Wochen der Mock-Daten, damit nur die hier geplanten Einträge zählen.
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0))
    const api = new MockPlannerApi(loadMockFiles)
    await api.createEntry({ date: '2026-10-13', meal: 'dinner', kind: 'recipe', recipeId: 'linsensuppe', servings: 8 })
    await api.createEntry({ date: '2026-10-13', meal: 'dinner', kind: 'item', text: '1 Baguette' })
    await api.createEntry({ date: '2026-10-14', meal: 'dinner', kind: 'recipe', recipeId: 'spaghetti-bolognese' })
    await api.createEntry({ date: '2026-10-19', meal: 'dinner', kind: 'recipe', recipeId: 'haehnchen-curry' })
    const spy = vi.spyOn(api, 'importShoppingFromPlan')
    const { user } = renderApp('/einkauf', api)

    await user.click(await screen.findByRole('button', { name: 'Aus dem Plan übernehmen' }))
    const dialog = screen.getByRole('dialog', { name: 'Aus dem Plan übernehmen' })
    expect(within(dialog).getByLabelText('Von')).toHaveValue('2026-10-12')
    expect(within(dialog).getByLabelText('Bis')).toHaveValue('2026-10-18')
    await user.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))

    expect(spy).toHaveBeenCalledWith('2026-10-12', '2026-10-18')
    expect(await screen.findByRole('checkbox', { name: /Tellerlinsen/ })).toHaveTextContent('333 g')
    expect(screen.getByRole('checkbox', { name: /Baguette/ })).toBeInTheDocument()
    // Das Curry liegt außerhalb des Zeitraums.
    expect(screen.queryByRole('checkbox', { name: /Hähnchenbrust/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ohne Zutaten: Spaghetti Bolognese')
    expect(screen.getByRole('link', { name: 'Zutaten für Spaghetti Bolognese nachtragen' })).toHaveAttribute(
      'href',
      '/rezepte/spaghetti-bolognese/bearbeiten',
    )
  })

  it('zeigt die Herkunft und merkt sich eine geänderte Kategorie', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.createEntry({ date: '2026-10-02', meal: 'dinner', kind: 'recipe', recipeId: 'linsensuppe' })
    await api.importShoppingFromPlan('2026-10-02', '2026-10-02')
    const { user } = renderApp('/einkauf', api)

    await user.click(await screen.findByRole('button', { name: 'Details zu Karotten' }))
    const dialog = screen.getByRole('dialog', { name: 'Karotten' })
    expect(within(dialog).getByText('Linsensuppe (Fr 02.10.): 2 Karotten')).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText('Kategorie'), 'Sonstiges')
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }))
    await vi.waitFor(() => expect(itemNames(section('Sonstiges'))).toContain('Karotten'))
    expect(itemNames(section('Obst & Gemüse'))).not.toContain('Karotten')

    // Gemerkt: neue Karotten landen ebenfalls unter Sonstiges.
    await user.click(screen.getByRole('checkbox', { name: /Karotten/ }))
    await user.type(screen.getByRole('textbox', { name: 'Artikel hinzufügen' }), '3 Karotten{Enter}')
    await vi.waitFor(() =>
      expect(itemNames(section('Sonstiges')).filter((name) => name === 'Karotten')).toHaveLength(2),
    )
  })

  it('führt Artikel zusammen, übernimmt sie in den Vorrat und löscht sie', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.addShoppingItem('1 Zwiebel')
    await api.addShoppingItem('3 Zwiebeln')
    await api.addShoppingItem('Spülmittel')
    const { user } = renderApp('/einkauf', api)

    await user.click(await screen.findByRole('button', { name: 'Details zu Zwiebel' }))
    let dialog = screen.getByRole('dialog', { name: 'Zwiebel' })
    await user.selectOptions(within(dialog).getByLabelText('Zusammenführen mit'), 'Zwiebeln')
    await user.click(within(dialog).getByRole('button', { name: 'Zusammenführen' }))
    await vi.waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Zwiebel' })).not.toBeInTheDocument())
    expect(screen.getByRole('checkbox', { name: /Zwiebeln/ })).toHaveTextContent('Zwiebeln4')
    expect(await api.listShoppingAliases()).toEqual([{ fromKey: 'zwiebel', fromName: 'Zwiebel', toName: 'Zwiebeln' }])

    await user.click(screen.getByRole('button', { name: 'Details zu Spülmittel' }))
    dialog = screen.getByRole('dialog', { name: 'Spülmittel' })
    await user.click(within(dialog).getByRole('button', { name: 'Zum Vorrat' }))
    expect(await screen.findByText('„Spülmittel“ steht jetzt im Vorrat.')).toBeInTheDocument()
    expect(await api.listStaples()).toEqual([expect.objectContaining({ text: 'Spülmittel' })])

    await user.click(screen.getByRole('button', { name: 'Details zu Spülmittel' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Löschen' }))
    await vi.waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Spülmittel' })).not.toBeInTheDocument())
  })

  it('filtert nach Geschäft, zeigt Artikel ohne Geschäft immer und merkt sich den Filter', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.createShoppingStore('Wochenmarkt')
    let list = await api.createShoppingStore('Supermarkt')
    const [market, supermarket] = list.stores
    list = await api.addShoppingItem('Äpfel')
    await api.updateShoppingItem(list.items[0].id, { storeId: market.id })
    await api.addShoppingItem('Milch')
    const { user } = renderApp('/einkauf', api)

    const filter = await screen.findByRole('combobox', { name: 'Geschäft' })
    await user.selectOptions(filter, 'Supermarkt')
    expect(screen.queryByRole('checkbox', { name: 'Äpfel' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Milch' })).toBeInTheDocument()
    expect(localStorage.getItem(STORE_FILTER_KEY)).toBe(supermarket.id)

    await user.selectOptions(filter, 'Alle Geschäfte')
    expect(screen.getByRole('checkbox', { name: 'Äpfel' })).toBeInTheDocument()
    expect(localStorage.getItem(STORE_FILTER_KEY)).toBeNull()
  })

  it('blendet den Geschäftsfilter ohne Geschäfte aus', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.addShoppingItem('Milch')
    renderApp('/einkauf', api)
    await screen.findByRole('checkbox', { name: 'Milch' })
    expect(screen.queryByRole('combobox', { name: 'Geschäft' })).not.toBeInTheDocument()
  })

  it('teilt die offenen Artikel über das Teilen-Menü oder kopiert sie', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.addShoppingItem('3 Zwiebeln')
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    const { user } = renderApp('/einkauf', api)

    await user.click(await screen.findByRole('button', { name: 'Teilen' }))
    expect(share).toHaveBeenCalledWith({ title: 'Einkaufsliste', text: 'Obst & Gemüse\n- Zwiebeln: 3' })

    Reflect.deleteProperty(navigator, 'share')
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await user.click(screen.getByRole('button', { name: 'Teilen' }))
    expect(writeText).toHaveBeenCalledWith('Obst & Gemüse\n- Zwiebeln: 3')
    expect(await screen.findByText('Die Liste wurde in die Zwischenablage kopiert.')).toBeInTheDocument()
  })
})

describe('Vorrat', () => {
  it('bringt angekreuzte Vorratsartikel auf die Einkaufsliste', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const { user } = renderApp('/einkauf/vorrat', api)

    const input = await screen.findByRole('textbox', { name: 'Zum Vorrat hinzufügen' })
    for (const text of ['Kaffee', 'Spülmittel', 'Reis']) {
      await user.type(input, `${text}{Enter}`)
      await screen.findByRole('checkbox', { name: text })
    }
    await user.click(screen.getByRole('checkbox', { name: 'Kaffee' }))
    await user.click(screen.getByRole('checkbox', { name: 'Reis' }))
    await user.click(screen.getByRole('button', { name: '2 auf die Einkaufsliste' }))

    expect(await screen.findByText('2 Artikel aus dem Vorrat übernommen.')).toBeInTheDocument()
    expect(currentUrl()).toBe('/einkauf')
    expect(screen.getByRole('checkbox', { name: 'Kaffee' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Reis' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Spülmittel' })).not.toBeInTheDocument()
  })

  it('entfernt Vorratsartikel', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    await api.createStaple('Kaffee')
    const { user } = renderApp('/einkauf/vorrat', api)
    await user.click(await screen.findByRole('button', { name: 'Kaffee aus dem Vorrat entfernen' }))
    expect(await screen.findByText(/Noch nichts im Vorrat/)).toBeInTheDocument()
  })
})

/** Ersatz für MediaRecorder: Beim Stoppen liefert er ein kleines Stück „Audio“. */
class FakeRecorder {
  static instances: FakeRecorder[] = []
  static isTypeSupported = (type: string) => type === 'audio/mp4'
  state: 'inactive' | 'recording' = 'inactive'
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  constructor(_stream: unknown, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? ''
    FakeRecorder.instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

function stubMicrophone() {
  const track = { stop: vi.fn() }
  FakeRecorder.instances = []
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
  })
  return track
}

function lineInputs(): HTMLInputElement[] {
  return screen.queryAllByRole('textbox', { name: /^Zeile \d+$/ }) as HTMLInputElement[]
}

async function openVoiceDialog(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Einkauf ansagen' }))
  return screen.getByRole('dialog', { name: 'Einkauf ansagen' })
}

async function evaluateText(user: ReturnType<typeof renderApp>['user'], text: string) {
  const dialog = await openVoiceDialog(user)
  await user.type(within(dialog).getByRole('textbox', { name: /Text|Einkaufsliste/ }), text)
  await user.click(within(dialog).getByRole('button', { name: 'Auswerten' }))
  return dialog
}

describe('Einkauf ansagen', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'mediaDevices')
  })

  it('fehlt, wenn der Sprachdienst nicht konfiguriert ist', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    vi.spyOn(api, 'getVoiceAvailability').mockResolvedValue(false)
    const { user } = renderApp('/einkauf', api)

    await user.type(await screen.findByRole('textbox', { name: 'Artikel hinzufügen' }), 'Kaffee{Enter}')
    expect(await screen.findByRole('checkbox', { name: 'Kaffee' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Einkauf ansagen' })).not.toBeInTheDocument()
  })

  it('beendet die Aufnahme nach 60 Sekunden und wertet sie aus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const track = stubMicrophone()
    const api = new MockPlannerApi(loadMockFiles)
    const parse = vi.spyOn(api, 'parseShoppingVoice')
    const { user } = renderApp('/einkauf', api)

    const dialog = await openVoiceDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Aufnahme starten' }))
    expect(await within(dialog).findByRole('button', { name: 'Fertig' })).toBeInTheDocument()
    expect(FakeRecorder.instances[0]).toMatchObject({ state: 'recording', mimeType: 'audio/mp4' })

    await act(() => vi.advanceTimersByTimeAsync(60_000))

    await vi.waitFor(() => expect(lineInputs().map((input) => input.value)).toEqual(['2 Gurken', 'Feta', 'Bier', 'Spülmittel']))
    expect(FakeRecorder.instances[0].state).toBe('inactive')
    expect(track.stop).toHaveBeenCalled()
    const audio = parse.mock.calls[0][0] as Blob
    expect(audio).toBeInstanceOf(Blob)
    expect(audio.type).toBe('audio/mp4')
  })

  it('wertet einen Freitext aus, wenn der Browser nicht aufnehmen kann', async () => {
    const { user } = renderApp('/einkauf')
    const dialog = await openVoiceDialog(user)
    expect(within(dialog).getByText(/Aufnehmen geht in diesem Browser nicht/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Aufnahme starten' })).not.toBeInTheDocument()

    await user.type(within(dialog).getByRole('textbox', { name: 'Einkaufsliste' }), '500g Hack{Enter}Tomaten (Dose){Enter}Parmesan')
    await user.click(within(dialog).getByRole('button', { name: 'Auswerten' }))

    await vi.waitFor(() => expect(lineInputs().map((input) => input.value)).toEqual(['500 g Hack', 'Tomaten (Dose)', 'Parmesan']))
    expect(within(dialog).getByRole('button', { name: '3 Artikel hinzufügen' })).toBeInTheDocument()
  })

  it('meldet, wenn nichts zum Einkaufen erkannt wurde, und bietet eine neue Aufnahme an', async () => {
    stubMicrophone()
    const { user } = renderApp('/einkauf')
    const dialog = await evaluateText(user, ', ,')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ich habe nichts zum Einkaufen herausgehört.')
    expect(within(dialog).getByRole('button', { name: 'Neu aufnehmen' })).toBeInTheDocument()
  })

  it('zeigt in der Vorschau Kategorie und Zusammenfassen', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    let list = await api.createShoppingCategory('Käsetheke')
    list = await api.addShoppingItem('Feta')
    const feta = list.items.find((item) => item.name === 'Feta')!
    await api.updateShoppingItem(feta.id, { categoryId: list.categories.find((c) => c.name === 'Käsetheke')!.id })
    await api.deleteShoppingItem(feta.id)
    await api.addShoppingItem('Bier')
    const { user } = renderApp('/einkauf', api)

    const dialog = await evaluateText(user, 'Feta, Bier')

    await vi.waitFor(() => expect(lineInputs()).toHaveLength(2))
    const [fetaLine, beerLine] = within(dialog).getAllByRole('listitem')
    expect(fetaLine).toHaveTextContent('Käsetheke')
    expect(fetaLine).not.toHaveTextContent('kommt zu')
    expect(beerLine).toHaveTextContent('kommt zu Bier dazu')
  })

  it('lässt die Liste beim Abbrechen unverändert', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const add = vi.spyOn(api, 'addShoppingItems')
    const { user } = renderApp('/einkauf', api)
    const version = (await api.getShoppingList())!.version

    const dialog = await evaluateText(user, 'Feta, Bier')
    await vi.waitFor(() => expect(lineInputs()).toHaveLength(2))
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
    expect((await api.getShoppingList())!.version).toBe(version)
    expect(screen.getByText('Die Einkaufsliste ist leer.')).toBeInTheDocument()
  })

  it('übernimmt korrigierte, entfernte und ergänzte Zeilen', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const preview = vi.spyOn(api, 'previewShoppingLines')
    const { user } = renderApp('/einkauf', api)

    const dialog = await evaluateText(user, 'Raum, Limetten, Eis')
    await vi.waitFor(() => expect(lineInputs()).toHaveLength(3))
    await user.clear(lineInputs()[0])
    await user.type(lineInputs()[0], 'Rum')
    await vi.waitFor(() => expect(preview).toHaveBeenLastCalledWith(['Rum', 'Limetten', 'Eis']))
    await user.click(within(dialog).getByRole('button', { name: 'Zeile 3 entfernen' }))
    await user.click(within(dialog).getByRole('button', { name: 'Zeile hinzufügen' }))
    await user.type(lineInputs()[2], 'Minze')
    await user.click(within(dialog).getByRole('button', { name: '3 Artikel hinzufügen' }))

    expect(await screen.findByText('Die angesagten Artikel sind auf der Liste.')).toBeInTheDocument()
    for (const name of ['Rum', 'Limetten', 'Minze']) expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    for (const name of ['Raum', 'Eis']) expect(screen.queryByRole('checkbox', { name })).not.toBeInTheDocument()
  })

  it('fügt alle Zeilen in einem Schritt hinzu', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const add = vi.spyOn(api, 'addShoppingItems')
    const { user } = renderApp('/einkauf', api)

    const dialog = await evaluateText(user, 'zwei Gurken, Feta, noch Bier und Spülmittel')
    await user.click(await within(dialog).findByRole('button', { name: '4 Artikel hinzufügen' }))

    expect(await screen.findByRole('checkbox', { name: /Gurken/ })).toBeInTheDocument()
    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith(['2 Gurken', 'Feta', 'Bier', 'Spülmittel'])
    for (const name of ['Feta', 'Bier', 'Spülmittel']) expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
  })

  it('meldet einen gestörten Sprachdienst, und das Eingabefeld funktioniert weiter', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    vi.spyOn(api, 'parseShoppingVoice').mockRejectedValue(
      new RequestError('fehlgeschlagen: 502', 502, 'Die Spracherkennung ist gerade nicht erreichbar.'),
    )
    const { user } = renderApp('/einkauf', api)

    const dialog = await evaluateText(user, 'Feta')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Die Spracherkennung ist gerade nicht erreichbar.')
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }))

    await user.type(screen.getByRole('textbox', { name: 'Artikel hinzufügen' }), 'Feta{Enter}')
    expect(await screen.findByRole('checkbox', { name: 'Feta' })).toBeInTheDocument()
  })
})
