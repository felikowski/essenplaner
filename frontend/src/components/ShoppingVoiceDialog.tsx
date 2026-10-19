import { useEffect, useRef, useState, type FormEvent } from 'react'
import { usePlannerApi } from '../api/context'
import { RequestError } from '../api/request'
import type { ShoppingLinePreview, ShoppingList } from '../types'
import { Modal } from './Modal'

/** Längste Aufnahme; danach endet sie von selbst und wird ausgewertet. */
export const MAX_RECORDING_MS = 60_000
/** Pause nach der letzten Eingabe in der Vorschau, bevor die Zeilen neu bewertet werden. */
export const PREVIEW_DEBOUNCE_MS = 400

// Safari (iOS) nimmt nur audio/mp4 auf; der Server nimmt alle drei an.
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg']

const UNREACHABLE = 'Die Spracherkennung ist gerade nicht erreichbar.'

interface Props {
  onAdded: (list: ShoppingList) => void
  onClose: () => void
}

interface Row {
  id: number
  text: string
  preview?: ShoppingLinePreview
}

type Phase = 'ready' | 'recording' | 'parsing' | 'preview' | 'saving'

function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

function audioType(): string | undefined {
  return AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type))
}

function message(error: unknown, fallback: string): string {
  if (error instanceof RequestError && error.serverMessage && error.status !== 500) return error.serverMessage
  return fallback
}

function formatSeconds(ms: number): string {
  const seconds = Math.min(60, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** „Einkauf ansagen“: Aufnahme oder Freitext, dann eine Vorschau, aus der alle Zeilen auf einmal auf die Liste kommen. */
export function ShoppingVoiceDialog({ onAdded, onClose }: Props) {
  const api = usePlannerApi()
  const [phase, setPhase] = useState<Phase>('ready')
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [micHint, setMicHint] = useState<string | null>(
    canRecord() ? null : 'Aufnehmen geht in diesem Browser nicht. Du kannst die Liste hier eintippen oder einfügen.',
  )
  const [elapsed, setElapsed] = useState(0)
  const [askingMic, setAskingMic] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timers = useRef<number[]>([])
  const nextRow = useRef(1)
  const previewRequest = useRef(0)
  const closed = useRef(false)

  function clearTimers() {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
  }

  function releaseMicrophone() {
    for (const track of stream.current?.getTracks() ?? []) track.stop()
    stream.current = null
  }

  useEffect(() => {
    // StrictMode hängt den Dialog in der Entwicklung einmal aus und wieder ein.
    closed.current = false
    return () => {
      // Dialog geschlossen: Aufnahme verwerfen und das Mikrofon freigeben.
      closed.current = true
      clearTimers()
      if (recorder.current?.state === 'recording') recorder.current.stop()
      releaseMicrophone()
    }
  }, [])

  async function evaluate(input: Blob | string) {
    setPhase('parsing')
    setError(null)
    try {
      const result = await api.parseShoppingVoice(input)
      if (closed.current) return
      setRows(result.lines.map((preview) => ({ id: nextRow.current++, text: preview.text, preview })))
      setPhase('preview')
    } catch (caught) {
      if (closed.current) return
      setError(message(caught, UNREACHABLE))
      setPhase('ready')
    }
  }

  async function startRecording() {
    setError(null)
    let media: MediaStream
    setAskingMic(true)
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setMicHint('Kein Zugriff auf das Mikrofon. Du kannst die Liste hier eintippen oder einfügen.')
      return
    } finally {
      setAskingMic(false)
    }
    if (closed.current) {
      for (const track of media.getTracks()) track.stop()
      return
    }
    stream.current = media
    const type = audioType()
    const next = type ? new MediaRecorder(media, { mimeType: type }) : new MediaRecorder(media)
    const chunks: Blob[] = []
    next.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    next.onstop = () => {
      clearTimers()
      releaseMicrophone()
      if (closed.current) return
      const blobType = (next.mimeType || type || 'audio/webm').split(';')[0]
      void evaluate(new Blob(chunks, { type: blobType }))
    }
    recorder.current = next
    next.start()
    const started = Date.now()
    setElapsed(0)
    setPhase('recording')
    const tick = () => {
      setElapsed(Date.now() - started)
      timers.current.push(window.setTimeout(tick, 1000))
    }
    timers.current.push(window.setTimeout(tick, 1000))
    timers.current.push(window.setTimeout(stopRecording, MAX_RECORDING_MS))
  }

  function stopRecording() {
    clearTimers()
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  function submitText(event: FormEvent) {
    event.preventDefault()
    if (text.trim()) void evaluate(text)
  }

  /** Bewertet die Zeilen nach einer Pause neu; nur die Antwort der letzten Anfrage zählt. */
  function schedulePreview(next: Row[]) {
    clearTimers()
    const request = ++previewRequest.current
    timers.current.push(
      window.setTimeout(async () => {
        const filled = next.filter((row) => row.text.trim())
        if (filled.length === 0) return
        try {
          const previews = await api.previewShoppingLines(filled.map((row) => row.text))
          if (closed.current || request !== previewRequest.current) return
          const byId = new Map(filled.map((row, index) => [row.id, previews[index]]))
          setRows((current) => current.map((row) => (byId.has(row.id) ? { ...row, preview: byId.get(row.id) } : row)))
          setError(null)
        } catch (caught) {
          if (closed.current || request !== previewRequest.current) return
          setError(message(caught, UNREACHABLE))
        }
      }, PREVIEW_DEBOUNCE_MS),
    )
  }

  function updateRows(next: Row[]) {
    setRows(next)
    schedulePreview(next)
  }

  function editRow(id: number, value: string) {
    updateRows(rows.map((row) => (row.id === id ? { id, text: value } : row)))
  }

  async function addAll() {
    const texts = rows.map((row) => row.text.trim()).filter(Boolean)
    if (texts.length === 0) return
    clearTimers()
    previewRequest.current++
    setPhase('saving')
    setError(null)
    try {
      onAdded(await api.addShoppingItems(texts))
    } catch (caught) {
      if (closed.current) return
      setError(message(caught, 'Die Artikel konnten nicht hinzugefügt werden. Bitte versuche es noch einmal.'))
      setPhase('preview')
    }
  }

  const count = rows.filter((row) => row.text.trim()).length
  const status =
    phase === 'recording'
      ? 'Aufnahme läuft'
      : phase === 'parsing'
        ? 'Ich werte die Ansage aus …'
        : phase === 'saving'
          ? 'Die Artikel werden hinzugefügt …'
          : ''

  return (
    <Modal title="Einkauf ansagen" onClose={onClose}>
      <p className="visually-hidden" aria-live="polite">
        {status}
      </p>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {phase === 'ready' && (
        <form className="form voice" onSubmit={submitText}>
          {micHint ? (
            <p className="form__hint">{micHint}</p>
          ) : (
            <>
              <p className="form__hint">
                Sag einfach, was fehlt, zum Beispiel „zwei Gurken, Feta, noch Bier und Spülmittel“. Höchstens eine Minute.
              </p>
              <button type="button" className="button voice__record" disabled={askingMic} onClick={startRecording}>
                {askingMic ? 'Warte auf das Mikrofon …' : error ? 'Neu aufnehmen' : 'Aufnahme starten'}
              </button>
            </>
          )}
          <label className="form__label" htmlFor="voice-text">
            {micHint ? 'Einkaufsliste' : 'Oder als Text'}
          </label>
          <textarea
            id="voice-text"
            className="textarea voice__text"
            value={text}
            maxLength={2000}
            placeholder={'500 g Hack\nTomaten (Dose)\nParmesan'}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="modal__actions">
            <button type="submit" className="button button--secondary" disabled={!text.trim()}>
              Auswerten
            </button>
            <button type="button" className="button button--secondary" onClick={onClose}>
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {phase === 'recording' && (
        <div className="voice voice--recording">
          <p className="voice__timer">
            <span className="voice__dot" aria-hidden="true" />
            <span>
              {formatSeconds(elapsed)} <span className="voice__limit">/ 1:00</span>
            </span>
          </p>
          <div className="modal__actions">
            <button type="button" className="button" onClick={stopRecording}>
              Fertig
            </button>
          </div>
        </div>
      )}

      {(phase === 'parsing' || phase === 'saving') && (
        <p className="voice__progress" aria-hidden="true">
          {status}
        </p>
      )}

      {phase === 'preview' && (
        <div className="voice">
          <ul className="voice-lines">
            {rows.map((row, index) => (
              <li key={row.id} className="voice-line">
                <div className="voice-line__main">
                  <input
                    className="input"
                    aria-label={`Zeile ${index + 1}`}
                    value={row.text}
                    maxLength={200}
                    autoComplete="off"
                    onChange={(event) => editRow(row.id, event.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-button icon-button--quiet"
                    aria-label={`Zeile ${index + 1} entfernen`}
                    onClick={() => updateRows(rows.filter((candidate) => candidate.id !== row.id))}
                  >
                    ✕
                  </button>
                </div>
                {row.preview && row.text.trim() && (
                  <p className="voice-line__meta">
                    {row.preview.category}
                    {row.preview.mergesInto && <> · kommt zu {row.preview.mergesInto} dazu</>}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="button button--secondary button--small voice__add-row"
            disabled={rows.length >= 50}
            onClick={() => setRows([...rows, { id: nextRow.current++, text: '' }])}
          >
            Zeile hinzufügen
          </button>
          <div className="modal__actions">
            <button type="button" className="button" disabled={count === 0} onClick={addAll}>
              {count === 1 ? '1 Artikel hinzufügen' : `${count} Artikel hinzufügen`}
            </button>
            <button type="button" className="button button--secondary" onClick={onClose}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
