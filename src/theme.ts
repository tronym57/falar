// Light / dark mode, chosen in Settings. "auto" follows the iPhone's setting.
import { kv } from './kv'

export type Mode = 'light' | 'dark' | 'auto'
const KEY = 'falar.mode'
const dark = matchMedia('(prefers-color-scheme: dark)')

export const getMode = (): Mode => (kv.get(KEY) as Mode | null) ?? 'auto'

/** Sets `data-theme` on <html> (the CSS only looks at that) and the status bar colour. */
function apply() {
  const mode = getMode()
  const isDark = mode === 'dark' || (mode === 'auto' && dark.matches)
  document.documentElement.dataset.theme = isDark ? 'falo-dark' : 'falo'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0f1312' : '#0b6e4f')
}

export function setMode(mode: Mode) {
  kv.set(KEY, mode)
  apply()
}

/** Call once at start, before the first render, so there's no flash of the wrong mode. */
export function initTheme() {
  apply()
  dark.addEventListener('change', apply)
}
