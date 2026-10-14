export class RequestError extends Error {
  readonly status: number
  /** Meldung aus dem Fehlerobjekt des Servers ({"error": "…"}), falls vorhanden. */
  readonly serverMessage: string | null

  constructor(message: string, status: number, serverMessage: string | null = null) {
    super(message)
    this.name = 'RequestError'
    this.status = status
    this.serverMessage = serverMessage
  }
}

/** Fetch-Wrapper mit relativer Basis-URL: Pfade werden gegen den eigenen Host aufgelöst. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new RequestError(
      `${init?.method ?? 'GET'} ${path} fehlgeschlagen: ${res.status}`,
      res.status,
      await readServerMessage(res),
    )
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function readServerMessage(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error
  } catch {
    // kein JSON
  }
  return null
}
