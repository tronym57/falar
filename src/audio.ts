import { useSyncExternalStore } from 'react'

// One shared player: starting a clip stops the previous one.
const el = new Audio()
el.preload = 'auto'

let playing: string | null = null
let queue: string[] = []
let onFail: ((id: string) => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

let slow = (() => { try { return localStorage.getItem('slowAudio') === '1' } catch { return false } })()

// A blob: URL (your own recording) plays as is; anything else is a course clip id.
const url = (id: string) => (id.startsWith('blob:') ? id : `${import.meta.env.BASE_URL}audio/${id}.mp3`)

// If a clip hasn't started after 10 s (bad connection), treat it as failed instead of hanging.
let stallTimer: number | undefined
el.addEventListener('playing', () => clearTimeout(stallTimer))

function start(id: string, auto = false) {
  clearTimeout(stallTimer)
  stallTimer = window.setTimeout(() => fail(id), 10_000)
  playing = id
  el.src = url(id)
  el.playbackRate = slow ? 0.75 : 1
  el.preservesPitch = true
  emit()
  el.play().catch(e => {
    // An automatic start blocked by the browser isn't an error: the play button is right there.
    if (auto && e?.name === 'NotAllowedError') { clearTimeout(stallTimer); playing = null; emit(); return }
    fail(id)
  })
}

function fail(id: string) {
  if (playing !== id) return
  clearTimeout(stallTimer)
  el.pause()
  playing = null
  queue = []
  emit()
  onFail?.(id)
}

el.addEventListener('ended', () => {
  const next = queue.shift()
  if (next) start(next)
  else { playing = null; emit() }
})
el.addEventListener('error', () => { if (playing) fail(playing) })

export const audio = {
  /** Play one clip. Tapping the clip that's playing stops it. */
  play(id: string) {
    queue = []
    if (playing === id) { el.pause(); playing = null; emit(); return }
    start(id)
  },
  /** Start a clip without a tap (e.g. when a listening exercise appears). */
  autoplay(id: string) { queue = []; start(id, true) },
  /** Play clips one after another (e.g. a whole dialogue). */
  playAll(ids: string[]) {
    if (!ids.length) return
    queue = ids.slice(1)
    start(ids[0])
  },
  /** Your own words have no recorded audio: use the phone's pt-PT voice. */
  speak(id: string, text: string) {
    queue = []
    el.pause()
    speechSynthesis.cancel()
    if (playing === id) { playing = null; emit(); return }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-PT'
    const voice = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-') === 'pt-PT')
    if (voice) u.voice = voice
    u.rate = slow ? 0.75 : 1
    u.onend = () => { if (playing === id) { playing = null; emit() } }
    u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') fail(id) }
    playing = id
    emit()
    speechSynthesis.speak(u)
  },
  stop() { queue = []; el.pause(); speechSynthesis.cancel(); playing = null; emit() },
  setSlow(v: boolean) {
    slow = v
    el.playbackRate = v ? 0.75 : 1
    try { localStorage.setItem('slowAudio', v ? '1' : '0') } catch { /* private mode: setting just isn't remembered */ }
    emit()
  },
  onError(fn: (id: string) => void) { onFail = fn },
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** Re-renders when playback starts/stops or the speed changes. */
export function useAudio() {
  const p = useSyncExternalStore(subscribe, () => playing)
  const s = useSyncExternalStore(subscribe, () => slow)
  return { playing: p, slow: s }
}
