import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so the PWA/service-worker plugin never
// runs during unit tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Stylesheets are stubbed to an empty string in tests — even with `?raw` —
    // except this one. The contrast test reads the colour tokens straight out
    // of it, and against an empty file it can only fail, with an error about a
    // missing token rather than about the colour.
    css: { include: [/src\/index\.css/] },
  },
})
