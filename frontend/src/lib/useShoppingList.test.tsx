import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlannerApiContext } from '../api/context'
import { MockPlannerApi } from '../api/MockPlannerApi'
import { loadMockFiles } from '../test/mockData'
import { useShoppingList } from './useShoppingList'

function Probe() {
  const { list } = useShoppingList()
  return <p data-testid="items">{list ? list.items.map((item) => `${item.name}${item.checked ? '✓' : ''}`).join(',') : 'lädt'}</p>
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useShoppingList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    setVisibility('visible')
  })

  it('fragt alle 10 Sekunden nach, solange die Seite sichtbar ist, und sofort beim Zurückkehren', async () => {
    const api = new MockPlannerApi(loadMockFiles)
    const list = await api.addShoppingItem('Milch')
    const spy = vi.spyOn(api, 'getShoppingList')
    render(
      <PlannerApiContext value={api}>
        <Probe />
      </PlannerApiContext>,
    )
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByTestId('items')).toHaveTextContent('Milch')
    expect(spy).toHaveBeenCalledTimes(1)

    // Jemand anderes hakt ab; spätestens nach 10 Sekunden ist es sichtbar.
    await api.setShoppingItemChecked(list.items[0].id, true)
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(screen.getByTestId('items')).toHaveTextContent('Milch✓')
    expect(spy).toHaveBeenLastCalledWith(list.version)

    // Unsichtbar: keine Abfragen.
    setVisibility('hidden')
    const calls = spy.mock.calls.length
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(spy).toHaveBeenCalledTimes(calls)

    await api.addShoppingItem('Butter')
    await act(async () => {
      setVisibility('visible')
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(spy).toHaveBeenCalledTimes(calls + 1)
    expect(screen.getByTestId('items')).toHaveTextContent('Butter')
  })
})
