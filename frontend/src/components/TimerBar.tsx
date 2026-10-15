import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { useTimers } from '../lib/timerContext'
import { formatTimerTime, remainingTime } from '../lib/timerModel'

export function TimerBar() {
  const { timers, now, pauseTimer, resumeTimer, addMinute, removeTimer, startTimer } = useTimers()
  const [collapsed, setCollapsed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const sorted = [...timers].sort((a, b) => remainingTime(a, now) - remainingTime(b, now))

  return (
    <aside className="timer-bar no-print" aria-label="Timer">
      <div className="timer-bar__inner">
        <button type="button" className="timer-bar__toggle" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed}>
          <span>Timer{timers.length > 0 ? ` (${timers.length})` : ''}</span>
          <span aria-hidden="true">{collapsed ? '▾' : '▴'}</span>
        </button>
        {!collapsed && (
          <>
            {sorted.length > 0 && (
              <ul className="timer-list">
                {sorted.map((timer) => (
                  <li key={timer.id} className="timer-list__item">
                    <div className="timer-list__summary">
                      <strong>{timer.name}</strong>
                      <time>{formatTimerTime(remainingTime(timer, now))}{timer.paused ? ' · pausiert' : ''}</time>
                    </div>
                    <div className="timer-list__actions">
                      <button type="button" onClick={() => timer.paused ? resumeTimer(timer.id) : pauseTimer(timer.id)}>
                        {timer.paused ? 'Weiter' : 'Pause'}
                      </button>
                      <button type="button" onClick={() => addMinute(timer.id)} aria-label={`${timer.name}: eine Minute verlängern`}>+1 Min.</button>
                      <button type="button" onClick={() => removeTimer(timer.id)} aria-label={`${timer.name}: abbrechen`}>Abbrechen</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="button button--secondary button--small timer-bar__add" onClick={() => setShowForm(true)}>
              Timer stellen
            </button>
          </>
        )}
      </div>
      {showForm && <TimerForm onStart={(name, durationMs) => { startTimer({ name, durationMs }); setShowForm(false) }} onClose={() => setShowForm(false)} />}
    </aside>
  )
}

function TimerForm({ onStart, onClose }: { onStart: (name: string, durationMs: number) => void; onClose: () => void }) {
  const [name, setName] = useState('Küchentimer')
  const [minutes, setMinutes] = useState('10')
  const [seconds, setSeconds] = useState('0')
  const durationMs = ((Number(minutes) || 0) * 60 + (Number(seconds) || 0)) * 1_000

  function submit(event: FormEvent) {
    event.preventDefault()
    if (durationMs > 0) onStart(name, durationMs)
  }

  return (
    <Modal title="Timer stellen" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="form__label" htmlFor="timer-name">Name</label>
        <input id="timer-name" className="input" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        <div className="timer-form__duration">
          <label>Minuten<input className="input" type="number" min="0" max="1440" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label>
          <label>Sekunden<input className="input" type="number" min="0" max="59" value={seconds} onChange={(event) => setSeconds(event.target.value)} /></label>
        </div>
        <p className="form__hint">Timer klingeln zuverlässig, solange die App geöffnet bleibt. Nach dem Schließen zeigt sie beim nächsten Öffnen, was abgelaufen ist.</p>
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="button" disabled={!name.trim() || durationMs <= 0}>Starten</button>
        </div>
      </form>
    </Modal>
  )
}
