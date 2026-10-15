import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.removeItem('essenplaner.timer.v1')
  localStorage.removeItem('essenplaner.timer-benachrichtigung-gefragt')
})
