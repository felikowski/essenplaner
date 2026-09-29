import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PlannerApiContext } from './api/context'
import { MockPlannerApi } from './api/MockPlannerApi'

const api = new MockPlannerApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlannerApiContext value={api}>
      <App />
    </PlannerApiContext>
  </StrictMode>,
)
