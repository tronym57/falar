import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The logo already fills its square, so no padding and a green background everywhere.
const bg = { resizeOptions: { background: '#0b6e4f' } }

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, ...bg },
    apple: { ...minimal2023Preset.apple, padding: 0, ...bg },
  },
  images: ['public/logo.svg'],
})
