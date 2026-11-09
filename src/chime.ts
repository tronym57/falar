// A short, soft two-note chime for a correct answer. Made with Web Audio (no file), quiet and quick,
// so hearing it fifty times in a row stays pleasant. Can be switched off in Settings.
import { kv } from './kv'

const KEY = 'falar.chime'
export const chimeOn = () => kv.get(KEY) !== 'off'
export const setChimeOn = (on: boolean) => kv.set(KEY, on ? 'on' : 'off')

/** How long to wait before playing speech after the chime, so they don't overlap. */
export const CHIME_MS = 320

let ctx: AudioContext | null = null
function context() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** iOS only starts audio from a tap: wake the context on the first touch so later chimes play. */
export function unlockChime() {
  const wake = () => { if (chimeOn()) context() }
  document.addEventListener('touchend', wake, { once: true, passive: true })
  document.addEventListener('click', wake, { once: true })
}

/** One bell-like note: a sine with a faint octave, fast attack, gentle fade. */
function note(c: AudioContext, freq: number, at: number, gain: number) {
  const out = c.createGain()
  out.gain.setValueAtTime(0, at)
  out.gain.linearRampToValueAtTime(gain, at + 0.008)
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.32)
  out.connect(c.destination)
  for (const [mult, g] of [[1, 1], [2, 0.18]] as const) {
    const o = c.createOscillator()
    const og = c.createGain()
    o.type = 'sine'
    o.frequency.value = freq * mult
    og.gain.value = g
    o.connect(og).connect(out)
    o.start(at)
    o.stop(at + 0.34)
  }
}

/** Rising fifth, A5 → E6: bright but soft. Returns whether it played. */
export function playChime() {
  if (!chimeOn()) return false
  try {
    const c = context()
    const t = c.currentTime + 0.01
    note(c, 880, t, 0.063)
    note(c, 1318.5, t + 0.085, 0.056)
    return true
  } catch { return false }
}
