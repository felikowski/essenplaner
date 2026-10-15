import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock'

function Probe() {
  const { supported } = useWakeLock()
  return <output>{supported ? 'unterstützt' : 'nicht unterstützt'}</output>
}

describe('useWakeLock', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('hält den Bildschirm an, fordert die Sperre beim Zurückkehren neu an und gibt sie frei', async () => {
    const release = vi.fn(async () => {})
    const request = vi.fn(async () => ({ release }))
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })

    const { unmount } = render(<Probe />)
    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')
    expect(document.querySelector('output')).toHaveTextContent('unterstützt')

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(request).toHaveBeenCalledTimes(2)

    unmount()
    expect(release).toHaveBeenCalled()
  })

  it('tut ohne Unterstützung nichts', () => {
    expect(() => render(<Probe />)).not.toThrow()
    expect(document.querySelector('output')).toHaveTextContent('nicht unterstützt')
  })
})
