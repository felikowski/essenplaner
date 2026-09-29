export class RequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'RequestError'
    this.status = status
  }
}

/** Fetch-Wrapper mit relativer Basis-URL: Pfade werden gegen den eigenen Host aufgelöst. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new RequestError(`${init?.method ?? 'GET'} ${path} fehlgeschlagen: ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}
