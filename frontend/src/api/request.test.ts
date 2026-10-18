import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestError, loginPath, request, setUnauthorizedHandler } from './request'

describe('request bei abgelaufener Sitzung', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const onUnauthorized = vi.fn()
  let restore: () => void

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    restore = setUnauthorizedHandler(onUnauthorized)
  })

  afterEach(() => {
    restore()
    fetchMock.mockReset()
    onUnauthorized.mockReset()
    vi.unstubAllGlobals()
  })

  it('leitet bei 401 zur Login-Seite weiter', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401 }))
    await expect(request('/api/recipes')).rejects.toBeInstanceOf(RequestError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('leitet bei anderen Fehlern nicht weiter', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":"forbidden"}', { status: 403 }))
    await expect(request('/api/entries', { method: 'POST' })).rejects.toBeInstanceOf(RequestError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('merkt sich die aktuelle Seite als Rücksprungziel', () => {
    expect(loginPath('/woche/2026-W40')).toBe('/login?returnTo=%2Fwoche%2F2026-W40')
    expect(loginPath('/rezepte?tag=suppe')).toBe('/login?returnTo=%2Frezepte%3Ftag%3Dsuppe')
    expect(loginPath('/')).toBe('/login')
    expect(loginPath('/login?fehler=x')).toBe('/login')
  })
})
