import { useState, type FormEvent } from 'react'
import { describeIngredient, parseIngredient } from '../lib/ingredient'
import type { Recipe } from '../types'
import { Modal } from './Modal'
import { RecipeChooser } from './RecipeChooser'

type Tab = 'recipe' | 'note' | 'item'

const TABS: { id: Tab; label: string }[] = [
  { id: 'recipe', label: 'Rezept' },
  { id: 'note', label: 'Notiz' },
  { id: 'item', label: 'Zutat' },
]

interface Props {
  /** z. B. „Mittwoch, 30.09. · Abendessen“ */
  label: string
  recipes: Recipe[]
  onAddRecipe: (recipeId: string) => void
  onAddText: (kind: 'note' | 'item', text: string) => void
  onClose: () => void
}

/** Fügt einer Mahlzeit ein Rezept, eine Notiz oder eine Einzelzutat hinzu. */
export function AddEntryDialog({ label, recipes, onAddRecipe, onAddText, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('recipe')
  const [text, setText] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (tab !== 'recipe' && text.trim()) onAddText(tab, text.trim())
  }

  const preview = tab === 'item' && text.trim() ? describeIngredient(parseIngredient(text)) : null

  return (
    <Modal title={`Hinzufügen: ${label}`} onClose={onClose}>
      <div className="tabs" role="tablist" aria-label="Art des Eintrags">
        {TABS.map(({ id, label: tabLabel }) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {tabLabel}
          </button>
        ))}
      </div>
      {tab === 'recipe' ? (
        <RecipeChooser recipes={recipes} onSelect={onAddRecipe} />
      ) : (
        <form className="form" onSubmit={submit}>
          <label className="form__label" htmlFor="entry-text">
            {tab === 'note' ? 'Notiz' : 'Zutat'}
          </label>
          <input
            id="entry-text"
            className="input"
            value={text}
            maxLength={200}
            autoComplete="off"
            placeholder={tab === 'note' ? 'z. B. Essen bei Oma' : 'z. B. 1 Baguette'}
            onChange={(event) => setText(event.target.value)}
          />
          {tab === 'item' && (
            <p className="form__hint">Einzelzutaten kommen später auf die Einkaufsliste.{preview && ` Erkannt: ${preview}`}</p>
          )}
          <div className="modal__actions">
            <button type="submit" className="button" disabled={!text.trim()}>
              Hinzufügen
            </button>
          </div>
        </form>
      )}
      <div className="modal__actions">
        <button type="button" className="button button--secondary" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Modal>
  )
}
