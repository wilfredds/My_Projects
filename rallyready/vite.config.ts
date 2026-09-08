import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import pkg from './package.json' with { type: 'json' }

/**
 * Stamped into the bundle so a feedback report can say which build it came
 * from. Testers are on whatever the service worker last gave them, which is
 * not necessarily what is deployed, and "it does that on mine" is unanswerable
 * without this.
 */
const BUILD = `${pkg.version} (${new Date().toISOString().slice(0, 10)})`

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The drill runner must survive a dead connection mid-session.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Inter is bundled from src/assets/fonts, so there is nothing to fetch
        // from a CDN at runtime — the whole app precaches.
      },
      manifest: {
        name: 'RallyReady — Badminton Training',
        short_name: 'RallyReady',
        description:
          'Audio-first badminton footwork drills, conditioning and progress tracking for solo players.',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
