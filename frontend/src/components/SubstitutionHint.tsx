import { useState } from 'react'
import type { Ingredient } from '../types'
import { substitutionsFor } from '../lib/substitutions'

export function SubstitutionHint({ ingredient, factor = 1 }: { ingredient: Ingredient; factor?: number }) {
  const [open, setOpen] = useState(false)
  const match = substitutionsFor(ingredient, factor)
  if (!match) return null

  return (
    <span className="substitution">
      <button
        type="button"
        className="substitution__toggle no-print"
        aria-label={`Ersatz für ${ingredient.name}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Ersatz
      </button>
      {open && (
        <span className="substitution__details" role="note">
          {match.suggestions.map((suggestion) => <span key={suggestion}>{suggestion}</span>)}
        </span>
      )}
    </span>
  )
}
