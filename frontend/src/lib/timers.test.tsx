import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimerBar } from '../components/TimerBar'
import { useTimers } from './timerContext'
import { TIMER_STORAGE_KEY } from './timerModel'
import { TimerProvider } from './timers'

function Starter() {
  const { startTimer } = useTimers()
  return (
    <>
      <button onClick={() => startTimer({ name: 'Nudeln', durationMs: 600_000 })}>10 starten</button>
      <button onClick={() => startTimer({ name: 'Brot', durationMs: 1_500_000 })}>25 starten</button>
      <button onClick={() => startTimer({ name: 'Kurz', durationMs: 1_000 })}>Kurz starten</button>
    </>
  )
}

function Timers() {
  return <TimerProvider><Starter /><TimerBar /></TimerProvider>
}

describe('TimerProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 15, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'AudioContext')
    Reflect.deleteProperty(window, 'Notification')
    Reflect.deleteProperty(navigator, 'serviceWorker')
    Reflect.deleteProperty(navigator, 'vibrate')
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  it('sortiert mehrere Timer nach Restzeit und bietet Pause, Verlängern und Abbrechen', () => {
    render(<Timers />)
    fireEvent.click(screen.getByRole('button', { name: '25 starten' }))
    fireEvent.click(screen.getByRole('button', { name: '10 starten' }))
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('Nudeln')).toBeInTheDocument()
    expect(within(items[1]).getByText('Brot')).toBeInTheDocument()

    fireEvent.click(within(items[0]).getByRole('button', { name: 'Pause' }))
    expect(within(items[0]).getByText(/pausiert/)).toBeInTheDocument()
    fireEvent.click(within(items[0]).getByRole('button', { name: /eine Minute verlängern/ }))
    expect(within(items[0]).getByText('11:00 · pausiert')).toBeInTheDocument()
    fireEvent.click(within(items[1]).getByRole('button', { name: /abbrechen/ }))
    expect(screen.queryByText('Brot')).not.toBeInTheDocument()
  })

  it('liest einen laufenden Timer nach dem Neuladen mit der richtigen Restzeit', () => {
    const first = render(<Timers />)
    fireEvent.click(screen.getByRole('button', { name: '10 starten' }))
    act(() => vi.advanceTimersByTime(330_000))
    expect(screen.getByText('4:30')).toBeInTheDocument()
    first.unmount()

    render(<Timers />)
    expect(screen.getByText('4:30')).toBeInTheDocument()
  })

  it('übernimmt Timer aus einem anderen Tab über das storage-Ereignis', () => {
    render(<Timers />)
    const timer = [{ id: 'extern', name: 'Ofen', paused: false, endsAt: Date.now() + 300_000 }]
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: TIMER_STORAGE_KEY, newValue: JSON.stringify(timer) })))
    expect(screen.getByText('Ofen')).toBeInTheDocument()
    expect(screen.getByText('5:00')).toBeInTheDocument()
  })

  it('alarmiert wiederholt, bis der abgelaufene Timer bestätigt wird', () => {
    const start = vi.fn()
    const stop = vi.fn()
    const oscillator = { frequency: { value: 0 }, connect: vi.fn(), start, stop }
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }
    class AudioContextMock {
      state = 'running'
      currentTime = 0
      destination = {}
      createOscillator = () => oscillator
      createGain = () => gain
      resume = vi.fn(async () => {})
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock })
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })

    render(<Timers />)
    fireEvent.click(screen.getByRole('button', { name: 'Kurz starten' }))
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Kurz')
    expect(start).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(2_000))
    expect(start).toHaveBeenCalledTimes(2)
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Fertig' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(vibrate).toHaveBeenCalled()
  })

  it('meldet einen im Hintergrund abgelaufenen Timer über den Service Worker', async () => {
    const showNotification = vi.fn(async () => {})
    const register = vi.fn(async () => ({}))
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register, ready: Promise.resolve({ showNotification }) },
    })
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'granted', requestPermission: vi.fn() },
    })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })

    render(<Timers />)
    expect(register).toHaveBeenCalledWith('/sw.js')
    fireEvent.click(screen.getByRole('button', { name: 'Kurz starten' }))
    await act(async () => vi.advanceTimersByTime(1_000))
    expect(showNotification).toHaveBeenCalledWith('Kurz', expect.objectContaining({ body: 'Der Timer ist fertig.' }))
  })

  it('zeigt nach der Rückkehr, wie lange ein Timer bereits abgelaufen ist', () => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify([
      { id: 'alt', name: 'Ofen', paused: false, endsAt: Date.now() - 180_000 },
    ]))
    render(<Timers />)
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Abgelaufen vor 3 Minuten')
  })
})
