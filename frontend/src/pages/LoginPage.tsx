import { useSearchParams } from 'react-router'

const errorMessages: Record<string, string> = {
  'kein-zugriff': 'Dieses Konto hat keinen Zugriff.',
  abgebrochen: 'Anmeldung abgebrochen.',
  fehlgeschlagen: 'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.',
}

/** Nur Pfade der eigenen App; das Backend prüft das noch einmal. */
function safeReturnTo(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/'
}

export function LoginPage() {
  const [params] = useSearchParams()
  const error = params.get('fehler')
  const returnTo = safeReturnTo(params.get('returnTo'))
  const loginUrl = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`

  return (
    <div className="login">
      <div className="login__card">
        <h1 className="login__title">Essenplaner</h1>
        <p className="login__intro">Melde dich an, um den Wochenplan der Familie zu sehen.</p>
        {error && (
          <p className="login__error" role="alert">
            {errorMessages[error] ?? errorMessages.fehlgeschlagen}
          </p>
        )}
        {/* Eine echte Navigation, kein Router-Link: Das Backend leitet weiter zu Auth0. */}
        <a className="button login__button" href={loginUrl}>
          Anmelden
        </a>
      </div>
    </div>
  )
}
