import { useState, type FormEvent } from 'react'
import { describeSource } from '../lib/shopping'
import type { ShoppingItem, ShoppingItemPatch, ShoppingList } from '../types'
import { Modal } from './Modal'

interface Props {
  item: ShoppingItem
  list: ShoppingList
  onSave: (patch: ShoppingItemPatch) => void
  onMerge: (targetId: string) => void
  onAddToStaples: () => void
  onDelete: () => void
  onClose: () => void
}

/** Details eines Artikels: Herkunft, Name, Menge, Kategorie, Geschäft, Zusammenführen, Vorrat, Löschen. */
export function ShoppingItemDialog({ item, list, onSave, onMerge, onAddToStaples, onDelete, onClose }: Props) {
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.display ?? '')
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [storeId, setStoreId] = useState(item.storeId ?? '')
  const [mergeTarget, setMergeTarget] = useState('')
  const others = list.items.filter((other) => other.id !== item.id && !other.checked)

  function submit(event: FormEvent) {
    event.preventDefault()
    const patch: ShoppingItemPatch = {}
    if (name.trim() && name.trim() !== item.name) patch.name = name.trim()
    if (quantity.trim() !== (item.display ?? '')) patch.quantity = quantity.trim()
    if (categoryId !== item.categoryId) patch.categoryId = categoryId
    if (storeId !== (item.storeId ?? '')) patch.storeId = storeId || null
    if (Object.keys(patch).length === 0) onClose()
    else onSave(patch)
  }

  return (
    <Modal title={item.name} onClose={onClose}>
      {item.sources.length > 0 && (
        <section aria-label="Herkunft">
          <h3 className="form__label">Herkunft</h3>
          <ul className="shopping-sources">
            {item.sources.map((source, index) => (
              <li key={index}>{describeSource(source, item.name)}</li>
            ))}
          </ul>
        </section>
      )}
      <form className="form" onSubmit={submit}>
        <label className="form__label" htmlFor="item-name">
          Name
        </label>
        <input id="item-name" className="input" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        <label className="form__label" htmlFor="item-quantity">
          Menge
        </label>
        <input
          id="item-quantity"
          className="input"
          value={quantity}
          placeholder="z. B. 500 g"
          autoComplete="off"
          onChange={(e) => setQuantity(e.target.value)}
        />
        <p className="form__hint">Eine geänderte Menge ersetzt die Mengen aus den Rezepten.</p>
        <label className="form__label" htmlFor="item-category">
          Kategorie
        </label>
        <select id="item-category" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {list.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {list.stores.length > 0 && (
          <>
            <label className="form__label" htmlFor="item-store">
              Geschäft
            </label>
            <select id="item-store" className="select" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Kein bestimmtes</option>
              {list.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="modal__actions">
          <button type="submit" className="button">
            Speichern
          </button>
        </div>
      </form>

      {others.length > 0 && (
        <div className="form shopping-merge">
          <label className="form__label" htmlFor="item-merge">
            Zusammenführen mit
          </label>
          <select id="item-merge" className="select" value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
            <option value="">Artikel wählen …</option>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </select>
          <p className="form__hint">Die Liste merkt sich das und legt „{item.name}“ künftig direkt dort ab.</p>
          <button
            type="button"
            className="button button--secondary"
            disabled={!mergeTarget}
            onClick={() => onMerge(mergeTarget)}
          >
            Zusammenführen
          </button>
        </div>
      )}

      <div className="modal__actions">
        <button type="button" className="button button--secondary" onClick={onAddToStaples}>
          Zum Vorrat
        </button>
        <button type="button" className="button button--danger" onClick={onDelete}>
          Löschen
        </button>
        <button type="button" className="button button--secondary" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Modal>
  )
}
