// Speech recognition (Safari/Chrome's webkitSpeechRecognition, pt-PT).
// iOS often never marks a result as final, so we keep the latest text heard and stop
// ourselves after 2.5 s of silence, or after 7 s if nothing is heard at all (spike finding).
import { audio } from './audio'

type Alt = { transcript: string }
type Result = ArrayLike<Alt> & { isFinal: boolean }
type Recognition = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean
  start(): void; stop(): void; abort(): void
  onresult: ((e: { results: ArrayLike<Result> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type Ctor = new () => Recognition

const ctor = (): Ctor | undefined => {
  const w = globalThis as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canRecognise = () => !!ctor()

// Once the mic is refused, iOS keeps refusing until the app restarts: remember it for this session
// so every question doesn't start with a failed tap.
let blocked = false
export const micBlocked = () => blocked
export const retryMic = () => { blocked = false }

/** What was heard: best guess, alternatives for the last phrase, and how fast you started (ms). */
export type Heard = { text: string; alts: string[]; error?: string; startMs?: number }

/** Plain-English reason for a recognition error. */
export function errorMessage(error?: string) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The microphone or speech recognition is blocked. Allow it when your iPhone asks (it asks again each time the app restarts).'
    case 'no-speech': return "Didn't hear anything. Tap the mic and speak a bit louder."
    case 'audio-capture': return 'No microphone found.'
    case 'network': return "Speech recognition needs a connection, and it couldn't reach the server."
    default: return error ? `Speech recognition stopped (${error}).` : "Didn't hear anything. Try again."
  }
}

/** Start listening. Returns a function that stops early (it still reports what was heard). */
export function listen({ onInterim, onEnd }: { onInterim?: (text: string) => void; onEnd: (h: Heard) => void }): () => void {
  const SR = ctor()
  if (!SR) { onEnd({ text: '', alts: [], error: 'unsupported' }); return () => {} }
  audio.stop() // don't let the app's own audio be "heard"
  const r = new SR()
  r.lang = 'pt-PT'
  r.interimResults = true
  r.maxAlternatives = 3
  r.continuous = false

  const started = performance.now()
  let text = ''
  let alts: string[] = []
  let error: string | undefined
  let startMs: number | undefined
  let silence = window.setTimeout(() => r.stop(), 7000)

  r.onresult = e => {
    const results = Array.from(e.results)
    text = results.map(x => x[0]?.transcript ?? '').join(' ').replace(/\s+/g, ' ').trim()
    const last = results[results.length - 1]
    // Alternatives for the last phrase, each prefixed with what came before it.
    const before = results.slice(0, -1).map(x => x[0]?.transcript ?? '').join(' ')
    alts = last ? Array.from(last).map(a => `${before} ${a.transcript}`.trim()) : []
    startMs ??= performance.now() - started
    onInterim?.(text)
    clearTimeout(silence)
    silence = window.setTimeout(() => r.stop(), 2500)
  }
  r.onerror = e => { error = e.error }
  r.onend = () => {
    clearTimeout(silence)
    if (!text && (error === 'not-allowed' || error === 'service-not-allowed')) blocked = true
    onEnd({ text, alts: alts.length ? alts : text ? [text] : [], error: text ? undefined : error, startMs })
  }
  try { r.start() } catch (e) { clearTimeout(silence); onEnd({ text: '', alts: [], error: (e as Error).message }) }
  return () => r.stop()
}
