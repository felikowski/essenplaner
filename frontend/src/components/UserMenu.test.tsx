import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles } from '../test/mockData'
import { renderApp } from '../test/renderApp'

describe('Konto in der Kopfzeile', () => {
  it('zeigt den Namen und bietet Abmelden an', async () => {
    const { user } = renderApp('/rezepte')
    const toggle = await screen.findByLabelText('Konto: Familie')
    expect(toggle).toHaveTextContent('F')

    await user.click(toggle)
    const logout = screen.getByRole('button', { name: 'Abmelden' })
    const form = logout.closest('form')
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/api/auth/logout')
  })

  it('zeigt das Profilbild, wenn Auth0 eines liefert', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    api.getMe = async () => ({ name: 'Anna', email: 'anna@example.com', picture: 'https://img.example/anna.png' })
    const { user } = renderApp('/rezepte', api)
    const toggle = await screen.findByLabelText('Konto: Anna')
    expect(toggle.querySelector('img')).toHaveAttribute('src', 'https://img.example/anna.png')
    await user.click(toggle)
    expect(screen.getByText('anna@example.com')).toBeInTheDocument()
  })
})
