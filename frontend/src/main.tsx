import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PlannerApiContext } from './api/context'
import { HttpPlannerApi } from './api/HttpPlannerApi'

const api = new HttpPlannerApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlannerApiContext value={api}>
      <App />
    </PlannerApiContext>
  </StrictMode>,
)
