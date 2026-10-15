import { useSearchParams } from 'react-router'

const MIN_SERVINGS = 1
const MAX_SERVINGS = 99

/** Liest gewählte Portionen aus `?portionen=` und hält die Adresse beim Ändern aktuell. */
export function useServingsParam(recipeServings: number | undefined): [number | undefined, (servings: number) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  if (recipeServings === undefined) return [undefined, () => {}]

  const param = searchParams.get('portionen') ?? ''
  const parsed = /^\d+$/.test(param) ? Number(param) : NaN
  const servings = parsed >= MIN_SERVINGS && parsed <= MAX_SERVINGS ? parsed : recipeServings

  function setServings(next: number) {
    setSearchParams(
      (params) => {
        if (next === recipeServings) params.delete('portionen')
        else params.set('portionen', String(next))
        return params
      },
      { replace: true },
    )
  }
  return [servings, setServings]
}
