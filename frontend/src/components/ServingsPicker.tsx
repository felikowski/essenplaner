const MIN_SERVINGS = 1
const MAX_SERVINGS = 99

interface ServingsPickerProps {
  servings: number
  recipeServings: number
  onChange: (servings: number) => void
}

export function ServingsPicker({ servings, recipeServings, onChange }: ServingsPickerProps) {
  return (
    <div className="servings-picker" role="group" aria-label="Portionen">
      <button type="button" className="icon-button" onClick={() => onChange(servings - 1)} disabled={servings <= MIN_SERVINGS} aria-label="Weniger Portionen">
        −
      </button>
      <output className="servings-picker__value" aria-live="polite">{servings}</output>
      <button type="button" className="icon-button" onClick={() => onChange(servings + 1)} disabled={servings >= MAX_SERVINGS} aria-label="Mehr Portionen">
        +
      </button>
      {servings !== recipeServings && (
        <button type="button" className="link-button" onClick={() => onChange(recipeServings)}>
          Rezept: {recipeServings}
        </button>
      )}
    </div>
  )
}
