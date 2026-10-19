import { describe, expect, it } from 'vitest'
import { readTheme, saveTheme, THEME_KEY } from './theme'

describe('Farbschema', () => {
  it('folgt ohne gespeicherte Wahl dem System', () => {
    expect(readTheme()).toBe('system')
  })

  it('ignoriert ungültige Werte', () => {
    localStorage.setItem(THEME_KEY, 'lila')
    expect(readTheme()).toBe('system')
  })

  it('merkt und entfernt die Wahl', () => {
    saveTheme('light')
    expect(readTheme()).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    saveTheme('system')
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})
