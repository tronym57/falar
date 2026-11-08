import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE is the path the app is served under, e.g. "/falar/" on GitHub Pages.
const base = process.env.BASE ?? '/'

export default defineConfig({
  base,
  // Shown in Settings, so you can tell whether the phone has the latest build.
  define: { __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in App.tsx, so a failure gets a clear message
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'Falar',
        short_name: 'Falar',
        description: 'European Portuguese trainer',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f6f7f5',
        theme_color: '#0b6e4f',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Audio is precached too, so lessons work offline (e.g. at the beach).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3}'],
      },
    }),
  ],
})
