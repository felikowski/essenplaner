import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Tests laufen in einer Zeitzone mit Sommerzeit, damit Datumsfehler rund um
// die Zeitumstellung auffallen. Die Test-Worker erben diese Variable.
process.env.TZ = 'Europe/Berlin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
