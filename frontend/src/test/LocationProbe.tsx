import { useLocation } from 'react-router'

/** Macht die aktuelle Adresse für Tests lesbar, siehe `currentUrl()` in renderApp. */
export function LocationProbe() {
  const { pathname, search } = useLocation()
  return (
    <output data-testid="location" hidden>
      {pathname + search}
    </output>
  )
}
