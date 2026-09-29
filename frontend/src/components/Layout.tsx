import { Link, NavLink, Outlet, useLocation } from 'react-router'

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
          </nav>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
