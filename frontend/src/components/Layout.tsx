import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { SettingsProvider } from '../lib/settings'
import { TimerProvider } from '../lib/timers'
import { TimerBar } from './TimerBar'

export function Layout() {
  const { pathname } = useLocation()
  const onWeek = pathname === '/' || pathname.startsWith('/woche')

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-title">
            Essenplaner
          </Link>
          <nav className="app-nav" aria-label="Hauptnavigation">
            <Link to="/" className="app-nav__link" aria-current={onWeek ? 'page' : undefined}>
              Woche
            </Link>
            <NavLink to="/rezepte" className="app-nav__link">
              Rezepte
            </NavLink>
            <NavLink to="/einkauf" className="app-nav__link">
              Einkauf
            </NavLink>
            <NavLink to="/einstellungen" className="app-nav__link app-nav__link--icon" aria-label="Einstellungen">
              ⚙
            </NavLink>
          </nav>
        </div>
      </header>
      <TimerProvider>
        <TimerBar />
        <main className="app-main">
          <SettingsProvider>
            <Outlet />
          </SettingsProvider>
        </main>
      </TimerProvider>
    </div>
  )
}
