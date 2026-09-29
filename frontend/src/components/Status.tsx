export function Loading() {
  return (
    <p className="status" role="status">
      Wird geladen …
    </p>
  )
}

interface LoadErrorProps {
  message: string
  onRetry: () => void
}

export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div className="alert" role="alert">
      <p>{message}</p>
      <button type="button" className="button" onClick={onRetry}>
        Erneut versuchen
      </button>
    </div>
  )
}
