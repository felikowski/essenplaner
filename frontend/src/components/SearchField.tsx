interface Props {
  value: string
  onChange: (value: string) => void
}

export function SearchField({ value, onChange }: Props) {
  return (
    <input
      type="search"
      className="search-field"
      aria-label="Rezepte durchsuchen"
      placeholder="Rezept suchen …"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
