import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'

function loginLink() {
  return screen.getByRole('link', { name: 'Anmelden' }).getAttribute('href')
}

describe('Login-Seite', () => {
  it('startet die Anmeldung mit der ursprünglichen Seite als Rücksprungziel', () => {
    renderApp('/login?returnTo=%2Fwoche%2F2026-W40')
    expect(screen.getByRole('heading', { name: 'Essenplaner' })).toBeInTheDocument()
    expect(loginLink()).toBe('/api/auth/login?returnTo=%2Fwoche%2F2026-W40')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // Ohne Kopfzeile der App
    expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).not.toBeInTheDocument()
  })

  it('ignoriert fremde Rücksprungziele', () => {
    renderApp('/login?returnTo=%2F%2Fevil.example')
    expect(loginLink()).toBe('/api/auth/login?returnTo=%2F')
  })

  it.each([
    ['kein-zugriff', 'Dieses Konto hat keinen Zugriff.'],
    ['abgebrochen', 'Anmeldung abgebrochen.'],
    ['fehlgeschlagen', 'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.'],
    ['unbekannt', 'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.'],
  ])('zeigt den Fehler %s verständlich an', (code, message) => {
    renderApp(`/login?fehler=${code}`)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })
})
