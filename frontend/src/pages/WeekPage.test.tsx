import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles } from '../test/mockData'
import { renderApp } from '../test/renderApp'

function dayCard(weekday: string) {
  return screen.getByRole('heading', { name: weekday }).closest('li') as HTMLElement
}

describe('Wochenplan', () => {
  beforeEach(() => {
    // Feste Uhr: Mittwoch, 30.09.2026
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Route und Anzeige', () => {
    it('leitet von / auf die aktuelle Woche KW 40/2026 weiter', async () => {
      renderApp('/')

      expect(await screen.findByRole('heading', { level: 1, name: 'KW 40 · 2026' })).toBeInTheDocument()
      expect(screen.getByText('28.09. – 04.10.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Woche' })).toHaveAttribute('aria-current', 'page')
    })

    it('zeigt alle Tage von Montag bis Sonntag mit Datum und markiert heute', async () => {
      renderApp('/woche/2026-W40')

      const days = await screen.findAllByRole('heading', { level: 2 })
      expect(days.map((heading) => heading.textContent)).toEqual([
        'Montag',
        'Dienstag',
        'Mittwoch',
        'Donnerstag',
        'Freitag',
        'Samstag',
        'Sonntag',
      ])
      expect(within(dayCard('Montag')).getByText('28.09.')).toBeInTheDocument()
      expect(within(dayCard('Sonntag')).getByText('04.10.')).toBeInTheDocument()
      expect(dayCard('Mittwoch')).toHaveAttribute('aria-current', 'date')
      expect(dayCard('Montag')).not.toHaveAttribute('aria-current')
    })

    it('zeigt geplante Rezepte und leere Tage', async () => {
      renderApp('/woche/2026-W40')

      expect(await screen.findByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
      expect(within(dayCard('Dienstag')).getByText('Noch nichts geplant')).toBeInTheDocument()
    })

    it('öffnet beim Tippen auf den Rezepttitel das Rezeptdetail', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('link', { name: 'Hähnchen-Curry' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Hähnchen-Curry' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Original ansehen' })).toBeInTheDocument()
    })

    it('meldet ungültige Wochen', () => {
      renderApp('/woche/2025-W53')

      expect(screen.getByRole('heading', { name: 'Diese Kalenderwoche gibt es nicht' })).toBeInTheDocument()
    })
  })

  describe('Wochennavigation', () => {
    it('blättert vor und zurück und springt mit „Heute“ zur aktuellen Woche', async () => {
      const { user } = renderApp('/woche/2026-W40')
      await screen.findByRole('heading', { level: 1, name: 'KW 40 · 2026' })

      await user.click(screen.getByRole('link', { name: 'Nächste Woche' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'KW 41 · 2026' })).toBeInTheDocument()
      expect(await screen.findByRole('link', { name: 'Gemüselasagne' })).toBeInTheDocument()

      await user.click(screen.getByRole('link', { name: 'Nächste Woche' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'KW 42 · 2026' })).toBeInTheDocument()

      await user.click(screen.getByRole('link', { name: 'Heute' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'KW 40 · 2026' })).toBeInTheDocument()

      await user.click(screen.getByRole('link', { name: 'Vorige Woche' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'KW 39 · 2026' })).toBeInTheDocument()
    })

    it('wechselt von KW 53/2026 auf KW 1/2027 ab Montag, 04.01.2027', async () => {
      const { user } = renderApp('/woche/2026-W53')

      await user.click(await screen.findByRole('link', { name: 'Nächste Woche' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'KW 1 · 2027' })).toBeInTheDocument()
      expect(await screen.findByText('04.01.')).toBeInTheDocument()
      expect(within(dayCard('Montag')).getByText('04.01.')).toBeInTheDocument()
    })

    it('bietet „Heute“ in der aktuellen Woche nicht als Link an', async () => {
      renderApp('/woche/2026-W40')
      await screen.findByRole('heading', { level: 1, name: 'KW 40 · 2026' })

      expect(screen.queryByRole('link', { name: 'Heute' })).not.toBeInTheDocument()
    })
  })

  describe('Einträge planen', () => {
    it('fügt einem leeren Tag ein Rezept hinzu', async () => {
      const { user } = renderApp('/woche/2026-W40')

      expect(await within(await findDayCard('Dienstag')).findByText('Noch nichts geplant')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Dienstag Abendessen: hinzufügen' }))
      const dialog = screen.getByRole('dialog', { name: 'Hinzufügen: Dienstag, 29.09. · Abendessen' })
      await user.click(within(dialog).getByRole('button', { name: /Pfannkuchen/ }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await within(dayCard('Dienstag')).findByRole('link', { name: 'Pfannkuchen' })).toBeInTheDocument()
    })

    it('filtert den Rezept-Auswahldialog lokal nach Gang', async () => {
      const { user } = renderApp('/woche/2026-W40')
      await user.click(await screen.findByRole('button', { name: 'Dienstag Abendessen: hinzufügen' }))
      await user.click(screen.getByRole('button', { name: 'Filter' }))
      const filterDialog = screen.getByRole('dialog', { name: 'Rezepte filtern' })
      await user.selectOptions(within(filterDialog).getByLabelText('Gang'), 'Suppe')
      await user.click(within(filterDialog).getByRole('button', { name: 'Fertig' }))

      const addDialog = screen.getByRole('dialog', { name: /Hinzufügen: Dienstag/ })
      expect(within(addDialog).getByRole('button', { name: /Linsensuppe/ })).toBeInTheDocument()
      expect(within(addDialog).queryByRole('button', { name: /Hähnchen-Curry/ })).not.toBeInTheDocument()
    })

    it('ergänzt eine Beilage, eine Notiz und eine Zutat in derselben Mahlzeit', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Mittwoch Abendessen: hinzufügen' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Linsensuppe/ }))
      await within(dayCard('Mittwoch')).findByRole('link', { name: 'Linsensuppe' })

      await user.click(screen.getByRole('button', { name: 'Mittwoch Abendessen: hinzufügen' }))
      await user.click(screen.getByRole('tab', { name: 'Notiz' }))
      await user.type(screen.getByLabelText('Notiz'), 'Oma kommt')
      await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))
      await within(dayCard('Mittwoch')).findByText('Oma kommt')

      await user.click(screen.getByRole('button', { name: 'Mittwoch Abendessen: hinzufügen' }))
      await user.click(screen.getByRole('tab', { name: 'Zutat' }))
      await user.type(screen.getByLabelText('Zutat'), '1 Baguette')
      await user.click(screen.getByRole('button', { name: 'Hinzufügen' }))

      const card = dayCard('Mittwoch')
      expect(await within(card).findByText('1 Baguette')).toBeInTheDocument()
      const texts = within(card)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
      expect(texts).toEqual([
        expect.stringContaining('Hähnchen-Curry'),
        expect.stringContaining('Linsensuppe'),
        expect.stringContaining('Oma kommt'),
        expect.stringContaining('Zutat: 1 Baguette'),
      ])
    })

    it('entfernt nur den gewählten Eintrag', async () => {
      const { user } = renderApp('/woche/2026-W40')
      await user.click(await screen.findByRole('button', { name: 'Mittwoch Abendessen: hinzufügen' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Linsensuppe/ }))
      await within(dayCard('Mittwoch')).findByRole('link', { name: 'Linsensuppe' })

      await user.click(screen.getByRole('button', { name: 'Hähnchen-Curry: Optionen' }))
      await user.click(screen.getByRole('button', { name: 'Entfernen' }))

      const card = dayCard('Mittwoch')
      await waitFor(() => expect(within(card).queryByRole('link', { name: 'Hähnchen-Curry' })).not.toBeInTheDocument())
      expect(within(card).getByRole('link', { name: 'Linsensuppe' })).toBeInTheDocument()
    })

    it('lässt den Tag unverändert, wenn der Dialog abgebrochen wird', async () => {
      const { user, api } = renderApp('/woche/2026-W40')
      const create = vi.spyOn(api, 'createEntry')

      await user.click(await screen.findByRole('button', { name: 'Mittwoch Abendessen: hinzufügen' }))
      await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Mittwoch Abendessen: hinzufügen' }))
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      expect(create).not.toHaveBeenCalled()
      expect(within(dayCard('Mittwoch')).getByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
    })

    it('bleibt beim Neuladen der Woche erhalten, solange die Seite offen ist', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Dienstag Abendessen: hinzufügen' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Pfannkuchen/ }))
      await within(dayCard('Dienstag')).findByRole('link', { name: 'Pfannkuchen' })

      await user.click(screen.getByRole('link', { name: 'Nächste Woche' }))
      await screen.findByRole('heading', { level: 1, name: 'KW 41 · 2026' })
      await user.click(screen.getByRole('link', { name: 'Vorige Woche' }))

      expect(await within(await findDayCard('Dienstag')).findByRole('link', { name: 'Pfannkuchen' })).toBeInTheDocument()
    })
  })

  describe('Portionen, Reste und Verschieben', () => {
    it('zeigt geänderte Portionen am Eintrag', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Linsensuppe: Optionen' }))
      expect(screen.getByText('Das Rezept ist für 6 Portionen.')).toBeInTheDocument()
      const servings = screen.getByLabelText('Portionen')
      await user.clear(servings)
      await user.type(servings, '8')
      await user.click(screen.getByRole('button', { name: 'Übernehmen' }))

      expect(await within(dayCard('Donnerstag')).findByText('8 Portionen')).toBeInTheDocument()
    })

    it('öffnet Rezept und Reste mit abweichenden Portionen des Eintrags', async () => {
      const { user } = renderApp('/woche/2026-W40')

      const soup = await within(await findDayCard('Donnerstag')).findByRole('link', { name: 'Linsensuppe' })
      expect(soup).toHaveAttribute('href', '/rezepte/linsensuppe')

      await user.click(screen.getByRole('button', { name: 'Linsensuppe: Optionen' }))
      const servings = screen.getByLabelText('Portionen')
      await user.clear(servings)
      await user.type(servings, '8')
      await user.click(screen.getByRole('button', { name: 'Übernehmen' }))
      await within(dayCard('Donnerstag')).findByText('8 Portionen')

      await user.click(within(dayCard('Donnerstag')).getByRole('button', { name: 'Linsensuppe: Optionen' }))
      await user.click(screen.getByRole('button', { name: 'Reste einplanen' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reste einplanen' }))
      await within(dayCard('Freitag')).findByText('Reste:')

      expect(within(dayCard('Donnerstag')).getByRole('link', { name: 'Linsensuppe' })).toHaveAttribute(
        'href',
        '/rezepte/linsensuppe?portionen=8',
      )
      expect(within(dayCard('Freitag')).getByRole('link', { name: 'Linsensuppe' })).toHaveAttribute(
        'href',
        '/rezepte/linsensuppe?portionen=8',
      )

      await user.click(within(dayCard('Freitag')).getByRole('link', { name: 'Linsensuppe' }))
      expect(await screen.findByRole('heading', { name: 'Zutaten für 8 Portionen' })).toBeInTheDocument()
    })

    it('plant Reste am nächsten Tag ein; ohne Original bleiben sie als Notiz', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Hähnchen-Curry: Optionen' }))
      await user.click(screen.getByRole('button', { name: 'Reste einplanen' }))
      const dialog = screen.getByRole('dialog', { name: 'Reste einplanen: Hähnchen-Curry' })
      expect(within(dialog).getByRole('button', { name: 'Do 01.10.' })).toHaveAttribute('aria-pressed', 'true')
      await user.click(within(dialog).getByRole('button', { name: 'Reste einplanen' }))

      const thursday = dayCard('Donnerstag')
      expect(await within(thursday).findByText('(von Mi 30.09.)')).toBeInTheDocument()
      expect(within(thursday).getByText('Reste:')).toBeInTheDocument()

      await user.click(within(dayCard('Mittwoch')).getByRole('button', { name: 'Hähnchen-Curry: Optionen' }))
      await user.click(screen.getByRole('button', { name: 'Entfernen' }))
      expect(await within(dayCard('Donnerstag')).findByText('Reste: Hähnchen-Curry')).toBeInTheDocument()
    })

    it('verschiebt einen Eintrag auf einen anderen Tag', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Hähnchen-Curry: Optionen' }))
      await user.click(screen.getByRole('button', { name: 'Verschieben' }))
      const dialog = screen.getByRole('dialog', { name: 'Verschieben: Hähnchen-Curry' })
      await user.click(within(dialog).getByRole('button', { name: 'Fr 02.10.' }))
      await user.click(within(dialog).getByRole('button', { name: 'Verschieben' }))

      expect(await within(dayCard('Freitag')).findByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
      expect(within(dayCard('Mittwoch')).getByText('Noch nichts geplant')).toBeInTheDocument()
    })

    it('verschiebt in eine andere Woche', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Hähnchen-Curry: Optionen' }))
      await user.click(screen.getByRole('button', { name: 'Verschieben' }))
      const date = screen.getByLabelText('Anderes Datum')
      await user.clear(date)
      await user.type(date, '2026-10-07')
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verschieben' }))

      await waitFor(() => expect(within(dayCard('Mittwoch')).getByText('Noch nichts geplant')).toBeInTheDocument())
      await user.click(screen.getByRole('link', { name: 'Nächste Woche' }))
      expect(await within(await findDayCard('Mittwoch')).findByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
    })
  })

  describe('Mahlzeiten', () => {
    it('zeigt mit mehreren sichtbaren Mahlzeiten deren Überschriften', async () => {
      const api = new MockPlannerApi(loadMockFiles)
      await api.updateSettings({ visibleMeals: ['lunch', 'dinner'] })
      await api.createEntry({ date: '2026-09-29', meal: 'lunch', kind: 'note', text: 'Kantine' })
      renderApp('/woche/2026-W40', api)

      const tuesday = await findDayCard('Dienstag')
      expect(await within(tuesday).findByRole('heading', { level: 3, name: 'Mittagessen' })).toBeInTheDocument()
      expect(within(tuesday).getByRole('heading', { level: 3, name: 'Abendessen' })).toBeInTheDocument()
      expect(within(tuesday).getByText('Kantine')).toBeInTheDocument()
      expect(within(tuesday).getByRole('button', { name: 'Dienstag Mittagessen: hinzufügen' })).toBeInTheDocument()
    })

    it('blendet Einträge ausgeblendeter Mahlzeiten aus, ohne sie zu löschen', async () => {
      const api = new MockPlannerApi(loadMockFiles)
      await api.createEntry({ date: '2026-09-29', meal: 'breakfast', kind: 'note', text: 'Müsli' })
      renderApp('/woche/2026-W40', api)

      expect(await within(await findDayCard('Dienstag')).findByText('Noch nichts geplant')).toBeInTheDocument()
      expect(screen.queryByText('Müsli')).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
    })
  })

  describe('Woche kopieren und drucken', () => {
    it('kopiert die Woche in eine leere Woche und zeigt sie', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Woche kopieren' }))
      await user.selectOptions(screen.getByLabelText('Kopieren nach'), 'KW 42 · 2026')
      await user.click(screen.getByRole('button', { name: 'Kopieren' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'KW 42 · 2026' })).toBeInTheDocument()
      expect(screen.getByText('KW 40 · 2026 wurde kopiert.')).toBeInTheDocument()
      expect(await within(await findDayCard('Mittwoch')).findByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
    })

    it('fragt bei belegter Zielwoche nach und ersetzt auf Wunsch', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Woche kopieren' }))
      await user.click(screen.getByRole('button', { name: 'Kopieren' }))
      expect(await screen.findByText(/KW 41 · 2026 enthält schon Einträge/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Ersetzen' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'KW 41 · 2026' })).toBeInTheDocument()
      expect(await within(await findDayCard('Mittwoch')).findByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Gemüselasagne' })).not.toBeInTheDocument()
    })

    it('öffnet den Druckdialog', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => {})
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Drucken' }))
      expect(print).toHaveBeenCalled()
      print.mockRestore()
    })
  })

  describe('Lade- und Fehlerzustände', () => {
    it('zeigt einen Ladehinweis, bis die Daten da sind', async () => {
      renderApp('/woche/2026-W40')

      expect(screen.getByRole('status')).toHaveTextContent('Wird geladen')
      await screen.findByRole('link', { name: 'Hähnchen-Curry' })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('zeigt eine Fehlermeldung, wenn das Laden fehlschlägt, und lädt auf Wunsch erneut', async () => {
      const load = vi.fn(loadMockFiles).mockRejectedValueOnce(new Error('offline'))
      const { user } = renderApp('/woche/2026-W40', new MockPlannerApi(load))

      expect(await screen.findByRole('alert')).toHaveTextContent('Der Wochenplan konnte nicht geladen werden.')
      expect(screen.getByRole('heading', { level: 1, name: 'KW 40 · 2026' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
      expect(await screen.findByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
    })

    it('zeigt eine Fehlermeldung, wenn das Speichern fehlschlägt, und lässt den Tag unverändert', async () => {
      const { user, api } = renderApp('/woche/2026-W40')
      vi.spyOn(api, 'createEntry').mockRejectedValue(new Error('Serverfehler'))

      await user.click(await screen.findByRole('button', { name: 'Mittwoch Abendessen: hinzufügen' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Linsensuppe/ }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Mittwoch konnte nicht gespeichert werden.')
      const card = dayCard('Mittwoch')
      expect(within(card).getByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
      expect(within(card).queryByRole('link', { name: 'Linsensuppe' })).not.toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'Mittwoch Abendessen: hinzufügen' })).toBeEnabled()
      // Der Rest der Woche bleibt sichtbar.
      expect(screen.getByRole('link', { name: 'Spaghetti Bolognese' })).toBeInTheDocument()
    })
  })
})

async function findDayCard(weekday: string) {
  return (await screen.findByRole('heading', { name: weekday })).closest('li') as HTMLElement
}
