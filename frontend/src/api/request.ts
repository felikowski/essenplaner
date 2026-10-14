export class RequestError extends Error {
  readonly status: number
  /** Meldung aus dem Fehlerobjekt des Servers ({"error": "…"}), falls vorhanden. */
  readonly serverMessage: string | null
  /** Betroffenes Feld bei Validierungsfehlern ({"error": "…", "field": "title"}). */
  readonly field: string | null

  constructor(message: string, status: number, serverMessage: string | null = null, field: string | null = null) {
    super(message)
    this.name = 'RequestError'
    this.status = status
    this.serverMessage = serverMessage
    this.field = field
  }
}

/** Fetch-Wrapper mit relativer Basis-URL: Pfade werden gegen den eigenen Host aufgelöst. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const { message, field } = await readErrorBody(res)
    throw new RequestError(`${init?.method ?? 'GET'} ${path} fehlgeschlagen: ${res.status}`, res.status, message, field)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function readErrorBody(res: Response): Promise<{ message: string | null; field: string | null }> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object') {
      const message = 'error' in body && typeof body.error === 'string' ? body.error : null
      const field = 'field' in body && typeof body.field === 'string' ? body.field : null
      return { message, field }
    }
  } catch {
    // kein JSON
  }
  return { message: null, field: null }
}
