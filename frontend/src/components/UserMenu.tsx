import { useCallback } from 'react'
import { usePlannerApi } from '../api/context'
import { useAsyncData } from '../lib/useAsyncData'

/** Profilbild oder Anfangsbuchstabe in der Kopfzeile; aufgeklappt Name und „Abmelden“. */
export function UserMenu() {
  const api = usePlannerApi()
  const load = useCallback(() => api.getMe(), [api])
  const { state } = useAsyncData(load)
  if (state.status !== 'ready') return null

  const { name, email, picture } = state.data
  const label = name || email || 'Angemeldet'
  return (
    <details className="user-menu">
      <summary className="user-menu__toggle" aria-label={`Konto: ${label}`}>
        {picture ? (
          <img className="user-menu__avatar" src={picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="user-menu__avatar user-menu__avatar--initial" aria-hidden="true">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </summary>
      <div className="user-menu__panel">
        <p className="user-menu__name">{label}</p>
        {email && email !== label && <p className="user-menu__email">{email}</p>}
        {/* Formular statt fetch: Der Browser soll der Weiterleitung zum Logout von Auth0 folgen. */}
        <form method="post" action="/api/auth/logout">
          <button type="submit" className="button button--secondary button--small user-menu__logout">
            Abmelden
          </button>
        </form>
      </div>
    </details>
  )
}
