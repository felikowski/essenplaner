import { createContext, useContext } from 'react'
import type { TimerContextValue } from './timerModel'

export const TimerContext = createContext<TimerContextValue | null>(null)

export function useTimers(): TimerContextValue {
  const value = useContext(TimerContext)
  if (!value) throw new Error('useTimers muss innerhalb des TimerProvider verwendet werden.')
  return value
}
