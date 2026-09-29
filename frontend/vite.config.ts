import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Tests laufen in einer Zeitzone mit Sommerzeit, damit Datumsfehler rund um
// die Zeitumstellung auffallen. Die Test-Worker erben diese Variable.
process.env.TZ = 'Europe/Berlin'

// Adresse des Go-Backends für den Dev-Proxy.
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backendUrl,
      '/healthz': backendUrl,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
