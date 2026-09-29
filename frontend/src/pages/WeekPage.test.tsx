import { screen, within } from '@testing-library/react'
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

  describe('Rezept zuordnen', () => {
    it('wählt für einen leeren Tag ein Rezept aus', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Dienstag: Rezept auswählen' }))
      const dialog = screen.getByRole('dialog', { name: 'Rezept für Dienstag, 29.09.' })
      await user.click(within(dialog).getByRole('button', { name: /Pfannkuchen/ }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await within(dayCard('Dienstag')).findByRole('link', { name: 'Pfannkuchen' })).toBeInTheDocument()
    })

    it('ersetzt das Rezept eines belegten Tages', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Mittwoch: Rezept ändern' }))
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByRole('button', { name: /Hähnchen-Curry/ })).toHaveAttribute('aria-current', 'true')
      await user.click(within(dialog).getByRole('button', { name: /Linsensuppe/ }))

      const card = dayCard('Mittwoch')
      expect(await within(card).findByRole('link', { name: 'Linsensuppe' })).toBeInTheDocument()
      expect(within(card).queryByText('Hähnchen-Curry')).not.toBeInTheDocument()
    })

    it('entfernt die Zuordnung mit „Kein Gericht“', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Mittwoch: Rezept ändern' }))
      await user.click(screen.getByRole('button', { name: 'Kein Gericht' }))

      expect(await within(dayCard('Mittwoch')).findByText('Noch nichts geplant')).toBeInTheDocument()
    })

    it('lässt den Tag unverändert, wenn der Dialog abgebrochen wird', async () => {
      const { user, api } = renderApp('/woche/2026-W40')
      const setDay = vi.spyOn(api, 'setDay')

      await user.click(await screen.findByRole('button', { name: 'Mittwoch: Rezept ändern' }))
      await user.click(screen.getByRole('button', { name: 'Abbrechen' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Mittwoch: Rezept ändern' }))
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      expect(setDay).not.toHaveBeenCalled()
      expect(within(dayCard('Mittwoch')).getByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
    })

    it('bleibt beim Neuladen der Woche erhalten, solange die Seite offen ist', async () => {
      const { user } = renderApp('/woche/2026-W40')

      await user.click(await screen.findByRole('button', { name: 'Dienstag: Rezept auswählen' }))
      await user.click(screen.getByRole('button', { name: /Pfannkuchen/ }))
      await within(dayCard('Dienstag')).findByRole('link', { name: 'Pfannkuchen' })

      await user.click(screen.getByRole('link', { name: 'Nächste Woche' }))
      await screen.findByRole('heading', { level: 1, name: 'KW 41 · 2026' })
      await user.click(screen.getByRole('link', { name: 'Vorige Woche' }))

      expect(await within(await findDayCard('Dienstag')).findByRole('link', { name: 'Pfannkuchen' })).toBeInTheDocument()
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

    it('zeigt eine Fehlermeldung, wenn setDay fehlschlägt, und lässt den Tag unverändert', async () => {
      const { user, api } = renderApp('/woche/2026-W40')
      vi.spyOn(api, 'setDay').mockRejectedValue(new Error('Serverfehler'))

      await user.click(await screen.findByRole('button', { name: 'Mittwoch: Rezept ändern' }))
      await user.click(screen.getByRole('button', { name: /Linsensuppe/ }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Mittwoch konnte nicht gespeichert werden.')
      const card = dayCard('Mittwoch')
      expect(within(card).getByRole('link', { name: 'Hähnchen-Curry' })).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'Mittwoch: Rezept ändern' })).toBeEnabled()
      // Der Rest der Woche bleibt sichtbar.
      expect(screen.getByRole('link', { name: 'Spaghetti Bolognese' })).toBeInTheDocument()
    })
  })
})

async function findDayCard(weekday: string) {
  return (await screen.findByRole('heading', { name: weekday })).closest('li') as HTMLElement
}
