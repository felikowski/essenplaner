import { createContext, useContext } from 'react'
import type { PlannerApi } from './PlannerApi'

export const PlannerApiContext = createContext<PlannerApi | null>(null)

export function usePlannerApi(): PlannerApi {
  const api = useContext(PlannerApiContext)
  if (!api) throw new Error('usePlannerApi muss innerhalb von PlannerApiContext verwendet werden')
  return api
}
