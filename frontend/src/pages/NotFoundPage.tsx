import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="page">
      <h1>Seite nicht gefunden</h1>
      <p>
        <Link to="/">Zur aktuellen Woche</Link>
      </p>
    </div>
  )
}
