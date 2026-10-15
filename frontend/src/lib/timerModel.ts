export const TIMER_STORAGE_KEY = 'essenplaner.timer.v1'

export interface KitchenTimer {
  id: string
  name: string
  paused: boolean
  endsAt?: number
  remainingMs?: number
  recipeId?: string
}

export interface StartTimerInput {
  name: string
  durationMs: number
  recipeId?: string
}

export interface TimerContextValue {
  timers: KitchenTimer[]
  now: number
  startTimer(input: StartTimerInput): void
  pauseTimer(id: string): void
  resumeTimer(id: string): void
  addMinute(id: string): void
  removeTimer(id: string): void
}

export function remainingTime(timer: KitchenTimer, now: number): number {
  return timer.paused ? Math.max(0, timer.remainingMs ?? 0) : Math.max(0, (timer.endsAt ?? now) - now)
}

export function formatTimerTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000))
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const rest = seconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`
}
