import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TimerContext } from './timerContext'
import { TIMER_STORAGE_KEY, type KitchenTimer, type StartTimerInput, type TimerContextValue } from './timerModel'

const NOTIFICATION_ASKED_KEY = 'essenplaner.timer-benachrichtigung-gefragt'

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<KitchenTimer[]>(readTimers)
  const [now, setNow] = useState(Date.now)
  const audio = useRef<AudioContext | null>(null)
  const notified = useRef(new Set<string>())

  useEffect(() => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timers))
  }, [timers])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === TIMER_STORAGE_KEY) setTimers(parseTimers(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const ticking = timers.some((timer) => !timer.paused)
  useEffect(() => {
    if (!ticking) return
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [ticking])

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js')
  }, [])

  const startTimer = useCallback((input: StartTimerInput) => {
    if (!(input.durationMs > 0)) return
    prepareAudio(audio)
    askForNotifications()
    const timer: KitchenTimer = {
      id: createTimerId(),
      name: input.name.trim() || 'Timer',
      endsAt: Date.now() + input.durationMs,
      paused: false,
      ...(input.recipeId ? { recipeId: input.recipeId } : {}),
    }
    setNow(Date.now())
    setTimers((current) => [...current, timer])
  }, [])

  const pauseTimer = useCallback((id: string) => {
    setTimers((current) => current.map((timer) => timer.id === id && !timer.paused
      ? { ...timer, paused: true, remainingMs: Math.max(0, (timer.endsAt ?? Date.now()) - Date.now()), endsAt: undefined }
      : timer))
  }, [])

  const resumeTimer = useCallback((id: string) => {
    prepareAudio(audio)
    setTimers((current) => current.map((timer) => timer.id === id && timer.paused
      ? { ...timer, paused: false, endsAt: Date.now() + (timer.remainingMs ?? 0), remainingMs: undefined }
      : timer))
    setNow(Date.now())
  }, [])

  const addMinute = useCallback((id: string) => {
    setTimers((current) => current.map((timer) => timer.id === id
      ? timer.paused
        ? { ...timer, remainingMs: (timer.remainingMs ?? 0) + 60_000 }
        : { ...timer, endsAt: (timer.endsAt ?? Date.now()) + 60_000 }
      : timer))
  }, [])

  const removeTimer = useCallback((id: string) => {
    notified.current.delete(id)
    setTimers((current) => current.filter((timer) => timer.id !== id))
  }, [])

  const expired = timers
    .filter((timer) => !timer.paused && (timer.endsAt ?? Number.POSITIVE_INFINITY) <= now)
    .sort((a, b) => (a.endsAt ?? 0) - (b.endsAt ?? 0))[0]

  useEffect(() => {
    if (!expired) return
    const signal = () => {
      beep(audio.current)
      navigator.vibrate?.([200, 100, 200])
    }
    signal()
    const interval = window.setInterval(signal, 2_000)
    if (document.visibilityState !== 'visible' && !notified.current.has(expired.id)) {
      notified.current.add(expired.id)
      showTimerNotification(expired)
    }
    return () => window.clearInterval(interval)
  }, [expired])

  const value = useMemo<TimerContextValue>(() => ({
    timers,
    now,
    startTimer,
    pauseTimer,
    resumeTimer,
    addMinute,
    removeTimer,
  }), [addMinute, now, pauseTimer, removeTimer, resumeTimer, startTimer, timers])

  return (
    <TimerContext value={value}>
      {children}
      {expired && <TimerAlarm timer={expired} now={now} onDone={() => removeTimer(expired.id)} />}
    </TimerContext>
  )
}

function TimerAlarm({ timer, now, onDone }: { timer: KitchenTimer; now: number; onDone: () => void }) {
  const elapsedMinutes = Math.floor(Math.max(0, now - (timer.endsAt ?? now)) / 60_000)
  return (
    <div className="timer-alarm" role="alertdialog" aria-modal="true" aria-labelledby="timer-alarm-title">
      <div className="timer-alarm__content">
        <p className="timer-alarm__eyebrow">Timer</p>
        <h2 id="timer-alarm-title">{timer.name}</h2>
        <p>{elapsedMinutes > 0 ? `Abgelaufen vor ${elapsedMinutes} ${elapsedMinutes === 1 ? 'Minute' : 'Minuten'}` : 'Fertig'}</p>
        <button type="button" className="button timer-alarm__button" onClick={onDone}>Fertig</button>
      </div>
    </div>
  )
}

function readTimers(): KitchenTimer[] {
  return parseTimers(localStorage.getItem(TIMER_STORAGE_KEY))
}

function parseTimers(value: string | null): KitchenTimer[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTimer)
  } catch {
    return []
  }
}

function isTimer(value: unknown): value is KitchenTimer {
  if (!value || typeof value !== 'object') return false
  const timer = value as Partial<KitchenTimer>
  return typeof timer.id === 'string' && typeof timer.name === 'string' && typeof timer.paused === 'boolean'
    && (timer.paused ? typeof timer.remainingMs === 'number' : typeof timer.endsAt === 'number')
}

function createTimerId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `timer-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function prepareAudio(ref: { current: AudioContext | null }) {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  try {
    ref.current ??= new AudioContextClass()
    if (ref.current.state === 'suspended') void ref.current.resume()
  } catch {
    // Ohne Audio läuft der sichtbare Alarm weiter.
  }
}

function beep(context: AudioContext | null) {
  if (!context) return
  try {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.15, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.35)
  } catch {
    // Der Dialog bleibt auch ohne Ton bedienbar.
  }
}

function askForNotifications() {
  if (!('Notification' in window) || localStorage.getItem(NOTIFICATION_ASKED_KEY)) return
  localStorage.setItem(NOTIFICATION_ASKED_KEY, '1')
  if (Notification.permission === 'default') void Notification.requestPermission()
}

function showTimerNotification(timer: KitchenTimer) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker.ready.then((registration) => registration.showNotification(timer.name, {
    body: 'Der Timer ist fertig.',
    tag: `timer-${timer.id}`,
    requireInteraction: true,
  }))
}
