import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { describeIngredient, parseIngredient } from '../lib/ingredient'

interface Props {
  lines: string[]
  onChange: (lines: string[]) => void
  invalid?: boolean
  describedBy?: string
}

/**
 * Zutaten als einzelne Zeilen mit Vorschau, wie die Zeile zerlegt wird. Enter legt eine neue Zeile an,
 * Backspace in einer leeren Zeile entfernt sie, mehrzeiliger Text aus der Zwischenablage wird verteilt.
 */
export function IngredientListEditor({ lines, onChange, invalid = false, describedBy }: Props) {
  const rows = lines.length > 0 ? lines : ['']
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  // Zeile, die nach dem nächsten Rendern den Fokus bekommen soll (neue oder vorherige Zeile).
  const pendingFocus = useRef<number | null>(null)

  useEffect(() => {
    if (pendingFocus.current === null) return
    const input = inputs.current[pendingFocus.current]
    pendingFocus.current = null
    if (input) {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }
  })

  function focusAfterRender(index: number) {
    pendingFocus.current = index
  }

  function update(index: number, value: string) {
    onChange(rows.map((line, i) => (i === index ? value : line)))
  }

  function insertAfter(index: number, newLines: string[] = ['']) {
    onChange([...rows.slice(0, index + 1), ...newLines, ...rows.slice(index + 1)])
    focusAfterRender(index + newLines.length)
  }

  function remove(index: number) {
    const next = rows.filter((_, i) => i !== index)
    onChange(next.length > 0 ? next : [''])
    focusAfterRender(Math.max(0, index - 1))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === 'Enter') {
      event.preventDefault()
      insertAfter(index)
    } else if (event.key === 'Backspace' && rows[index] === '' && rows.length > 1) {
      event.preventDefault()
      remove(index)
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = event.clipboardData.getData('text')
    if (!/\r?\n/.test(text)) return
    event.preventDefault()
    const pasted = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (pasted.length === 0) return
    const input = event.currentTarget
    const before = input.value.slice(0, input.selectionStart ?? input.value.length)
    const after = input.value.slice(input.selectionEnd ?? input.value.length)
    const first = (before + pasted[0]).trim()
    const rest = pasted.slice(1)
    if (rest.length > 0) rest[rest.length - 1] = (rest[rest.length - 1] + after).trim()
    const next = rows.map((line, i) => (i === index ? (rest.length > 0 ? first : first + after) : line))
    onChange([...next.slice(0, index + 1), ...rest, ...next.slice(index + 1)])
    focusAfterRender(index + rest.length)
  }

  return (
    <div className="ingredient-editor">
      <ol className="ingredient-editor__list">
        {rows.map((line, index) => {
          const preview = line.trim() ? describeIngredient(parseIngredient(line)) : null
          return (
            <li key={index} className="ingredient-editor__row">
              <div className="ingredient-editor__field">
                <input
                  ref={(element) => {
                    inputs.current[index] = element
                  }}
                  className="input"
                  value={line}
                  aria-label={`Zutat ${index + 1}`}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  placeholder={index === 0 ? 'z. B. 200 g Mehl' : undefined}
                  enterKeyHint="next"
                  autoComplete="off"
                  onChange={(event) => update(index, event.target.value)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  onPaste={(event) => onPaste(event, index)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Zutat ${index + 1} entfernen`}
                  onClick={() => remove(index)}
                  disabled={rows.length === 1 && line === ''}
                >
                  ×
                </button>
              </div>
              {preview && (
                <p className="ingredient-editor__preview" data-testid={`ingredient-preview-${index + 1}`}>
                  {preview}
                </p>
              )}
            </li>
          )
        })}
      </ol>
      <button type="button" className="button button--secondary button--small" onClick={() => insertAfter(rows.length - 1)}>
        Zutat hinzufügen
      </button>
    </div>
  )
}
