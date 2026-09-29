import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../App'
import { PlannerApiContext } from '../api/context'
import { MockPlannerApi } from '../api/MockPlannerApi'
import type { PlannerApi } from '../api/PlannerApi'
import { loadMockFiles } from './mockData'

/** Rendert die ganze App unter `path`, standardmäßig mit den Dummy-Daten. */
export function renderApp(path: string, api: PlannerApi = new MockPlannerApi(loadMockFiles)) {
  const user = userEvent.setup()
  render(
    <PlannerApiContext value={api}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </PlannerApiContext>,
  )
  return { user, api }
}
