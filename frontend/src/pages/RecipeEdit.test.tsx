import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { RequestError } from '../api/request'
import { loadMockFiles } from '../test/mockData'
import { renderApp } from '../test/renderApp'

function ingredientInputs() {
  return screen.getAllByRole('textbox', { name: /^Zutat \d+$/ })
}

describe('Eigenes Rezept anlegen', () => {
  it('legt aus der Rezeptliste ein Rezept an und zeigt es danach', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const { user } = renderApp('/rezepte', api)

    await user.click(await screen.findByRole('link', { name: 'Neues Rezept' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Neues Rezept' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Titel'), 'Omas Gulasch')
    await user.type(screen.getByLabelText('Portionen'), '4')
    await user.type(ingredientInputs()[0], '1 kg Rindergulasch{Enter}3 Zwiebeln')
    await user.type(screen.getByLabelText('Zubereitung'), 'Anbraten.{Enter}Schmoren.')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Omas Gulasch' })).toBeInTheDocument()
    expect(screen.getByText('Eigenes Rezept')).toBeInTheDocument()
    expect(screen.getByText('4 Portionen')).toBeInTheDocument()
    expect(screen.getByText('1 kg Rindergulasch')).toBeInTheDocument()
    expect(screen.getByText('Schmoren.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Original ansehen' })).not.toBeInTheDocument()

    const recipes = await api.listRecipes()
    expect(recipes.find((recipe) => recipe.title === 'Omas Gulasch')).toMatchObject({
      servings: 4,
      ingredients: [
        { text: '1 kg Rindergulasch', quantity: 1, unit: 'kg', name: 'Rindergulasch' },
        { text: '3 Zwiebeln', quantity: 3, name: 'Zwiebeln' },
      ],
    })
  })

  it('verlangt einen Titel und speichert ohne ihn nichts', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const create = vi.spyOn(api, 'createRecipe')
    const { user } = renderApp('/rezepte/neu', api)

    await user.type(ingredientInputs()[0], '200 g Mehl')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Bitte einen Titel eingeben.')
    expect(screen.getByLabelText('Titel')).toHaveAttribute('aria-invalid', 'true')
    expect(create).not.toHaveBeenCalled()
    expect(ingredientInputs()[0]).toHaveValue('200 g Mehl')
  })

  it('zeigt Fehler des Servers am Feld, ohne Eingaben zu verlieren', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    vi.spyOn(api, 'createRecipe').mockRejectedValue(
      new RequestError('x', 422, 'Höchstens 100 Zutaten sind möglich.', 'ingredients'),
    )
    const { user } = renderApp('/rezepte/neu', api)

    await user.type(screen.getByLabelText('Titel'), 'Riesenrezept')
    await user.type(ingredientInputs()[0], '1 Ei')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Höchstens 100 Zutaten sind möglich.')
    expect(ingredientInputs()[0]).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Titel')).toHaveValue('Riesenrezept')
  })

  it('meldet andere Fehler allgemein', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    vi.spyOn(api, 'createRecipe').mockRejectedValue(new RequestError('x', 500))
    const { user } = renderApp('/rezepte/neu', api)

    await user.type(screen.getByLabelText('Titel'), 'A')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('konnte nicht gespeichert werden')
  })

  it('legt bei einem Fehler der Einordnung beim erneuten Speichern kein zweites Rezept an', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const original = api.updateRecipeOrganization.bind(api)
    vi.spyOn(api, 'updateRecipeOrganization').mockRejectedValueOnce(new RequestError('x', 500)).mockImplementation(original)
    const { user } = renderApp('/rezepte/neu', api)
    await user.type(screen.getByLabelText('Titel'), 'Einmalig')
    await user.type(screen.getByLabelText('Tags'), 'Test')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Einordnung nicht')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('heading', { name: 'Einmalig' })).toBeInTheDocument()
    expect((await api.listRecipes()).filter((recipe) => recipe.title === 'Einmalig')).toHaveLength(1)
  })
})

describe('Zutatenliste im Formular', () => {
  it('zeigt beim Tippen, wie die Zeile zerlegt wird', async () => {
    const { user } = renderApp('/rezepte/neu')

    await user.type(ingredientInputs()[0], '2 EL Olivenöl')

    expect(screen.getByTestId('ingredient-preview-1')).toHaveTextContent('2 · EL · Olivenöl')
  })

  it('legt mit Enter eine neue Zeile an und entfernt leere Zeilen mit Backspace', async () => {
    const { user } = renderApp('/rezepte/neu')

    await user.type(ingredientInputs()[0], '200 g Mehl{Enter}')
    expect(ingredientInputs()).toHaveLength(2)
    expect(ingredientInputs()[1]).toHaveFocus()

    await user.keyboard('{Backspace}')
    expect(ingredientInputs()).toHaveLength(1)
    expect(ingredientInputs()[0]).toHaveFocus()
    expect(ingredientInputs()[0]).toHaveValue('200 g Mehl')
  })

  it('verteilt mehrzeiligen Text aus der Zwischenablage auf mehrere Zeilen', async () => {
    renderApp('/rezepte/neu')
    const first = ingredientInputs()[0]

    fireEvent.paste(first, { clipboardData: { getData: () => '200 g Mehl\n\n2 Eier\r\n1 Prise Salz\n' } })

    expect(ingredientInputs().map((input) => (input as HTMLInputElement).value)).toEqual([
      '200 g Mehl',
      '2 Eier',
      '1 Prise Salz',
    ])
  })

  it('entfernt einzelne Zeilen über den Knopf', async () => {
    const { user } = renderApp('/rezepte/neu')

    await user.type(ingredientInputs()[0], 'A{Enter}B{Enter}C')
    await user.click(screen.getByRole('button', { name: 'Zutat 2 entfernen' }))

    expect(ingredientInputs().map((input) => (input as HTMLInputElement).value)).toEqual(['A', 'C'])
  })
})

describe('Rezept bearbeiten', () => {
  it('trägt Zutaten zu einem PDF-Rezept nach; der Titel bleibt fest', async () => {
    const { user } = renderApp('/rezepte/gemueselasagne')

    expect(await screen.findByText(/noch keine Zutaten erfasst/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Zutaten nachtragen' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Rezept bearbeiten' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Titel' })).not.toBeInTheDocument()
    expect(screen.getByText('Gemüselasagne')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Portionen'), '4')
    await user.type(ingredientInputs()[0], '12 Lasagneplatten{Enter}2 Zucchini')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Gemüselasagne' })).toBeInTheDocument()
    expect(screen.getByText('12 Lasagneplatten')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'PDF öffnen' })).toBeInTheDocument()
  })

  it('übernimmt die vorhandenen Angaben ins Formular', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry')

    await user.click(await screen.findByRole('link', { name: 'Bearbeiten' }))

    expect(await screen.findByLabelText('Portionen')).toHaveValue(4)
    expect(ingredientInputs()).toHaveLength(8)
    expect(ingredientInputs()[0]).toHaveValue('600 g Hähnchenbrust')
    expect((screen.getByLabelText('Zubereitung') as HTMLTextAreaElement).value).toContain(
      'Reis nach Packungsanweisung kochen.\nHähnchen in Würfel schneiden',
    )
    expect(screen.getByLabelText('Gang')).toHaveValue('Hauptgericht')
    expect(screen.getByLabelText('Küche')).toHaveValue('Indisch')
    await vi.waitFor(() => expect(document.querySelector('#recipe-tags-list option[value="vegetarisch"]')).not.toBeNull())
  })

  it('speichert Gang, Küche, Tags, Zeit und Familiennotiz im zweiten Aufruf', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const organization = vi.spyOn(api, 'updateRecipeOrganization')
    const { user } = renderApp('/rezepte/gemueselasagne/bearbeiten', api)
    await screen.findByRole('heading', { name: 'Rezept bearbeiten' })
    await user.selectOptions(screen.getByLabelText('Gang'), 'Hauptgericht')
    await user.type(screen.getByLabelText('Küche'), 'italienisch')
    await user.type(screen.getByLabelText('Tags'), 'schnell, Vegetarisch')
    await user.type(screen.getByLabelText('Zubereitungszeit in Minuten'), '45')
    await user.type(screen.getByLabelText('Notizen der Familie'), 'Mit weniger Käse')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('Hauptgericht · Italienisch · 45 Min.')).toBeInTheDocument()
    expect(screen.getByText(/Mit weniger Käse/)).toBeInTheDocument()
    expect(organization).toHaveBeenCalledWith('gemueselasagne', expect.objectContaining({ tags: ['schnell', 'Vegetarisch'], totalMinutes: 45 }))
  })

  it('meldet einen Fehler gezielt, wenn nur die Einordnung nicht gespeichert werden kann', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    vi.spyOn(api, 'updateRecipeOrganization').mockRejectedValueOnce(new RequestError('x', 500))
    const { user } = renderApp('/rezepte/haehnchen-curry/bearbeiten', api)
    await screen.findByRole('heading', { name: 'Rezept bearbeiten' })
    await user.type(screen.getByLabelText('Notizen der Familie'), ' Neu')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Rezept wurde gespeichert, aber die Einordnung nicht')
    expect(screen.getByLabelText('Notizen der Familie')).toHaveValue('Mit weniger Chili für die Kinder. Neu')
  })

  it('fragt beim Abbrechen nach, wenn es ungespeicherte Änderungen gibt', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/bearbeiten')

    await user.type((await screen.findAllByRole('textbox', { name: /^Zutat \d+$/ }))[0], ' (Bio)')
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))

    const dialog = screen.getByRole('dialog', { name: 'Änderungen verwerfen?' })
    await user.click(within(dialog).getByRole('button', { name: 'Weiter bearbeiten' }))
    expect(ingredientInputs()[0]).toHaveValue('600 g Hähnchenbrust (Bio)')

    await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
    await user.click(screen.getByRole('button', { name: 'Verwerfen' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Hähnchen-Curry' })).toBeInTheDocument()
    expect(screen.getByText('600 g Hähnchenbrust')).toBeInTheDocument()
  })

  it('bricht ohne Änderungen sofort ab', async () => {
    const { user } = renderApp('/rezepte/haehnchen-curry/bearbeiten')

    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Hähnchen-Curry' })).toBeInTheDocument()
  })

  it('benennt eigene Rezepte um und entfernt sie nach Rückfrage', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const recipe = await api.createRecipe({ title: 'Brotzeit', servings: null, ingredients: [], instructions: [] })
    const { user } = renderApp(`/rezepte/${recipe.id}/bearbeiten`, api)

    const title = await screen.findByLabelText('Titel')
    await user.clear(title)
    await user.type(title, 'Abendbrot')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Abendbrot' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rezept entfernen' }))
    await user.click(screen.getByRole('button', { name: 'Endgültig entfernen' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Rezepte' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Abendbrot/ })).not.toBeInTheDocument()
  })

  it('meldet unbekannte Rezepte', async () => {
    renderApp('/rezepte/gibt-es-nicht/bearbeiten')
    expect(await screen.findByRole('heading', { level: 1, name: 'Rezept nicht gefunden' })).toBeInTheDocument()
  })
})
