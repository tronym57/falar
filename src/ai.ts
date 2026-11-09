// Google Gemini (free tier, your own API key) for the conversation partner and reading on any topic.
// The key lives only on this phone (localStorage), never in the code or the backup.
import { useSyncExternalStore } from 'react'
import { kv } from './kv'
import { bpProblems } from './bp'

const API = 'https://generativelanguage.googleapis.com/v1beta'
const K = { key: 'falar.gemini.key', model: 'falar.gemini.model', name: 'falar.learner.name' }

// ---------- settings (React can subscribe) ----------
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
export const aiKey = () => kv.get(K.key)
export const aiModel = () => kv.get(K.model)
export const learnerName = () => kv.get(K.name) ?? ''
export function setLearnerName(name: string) { kv.set(K.name, name.trim()); emit() }
export function disconnectAi() { kv.remove(K.key); kv.remove(K.model); emit() }
/** Re-renders when the key, model or name changes. */
export function useAi() {
  const sub = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
  const key = useSyncExternalStore(sub, aiKey)
  const model = useSyncExternalStore(sub, aiModel)
  const name = useSyncExternalStore(sub, learnerName)
  return { connected: !!key, model, name }
}

// ---------- errors in plain English ----------
export type AiErrorKind = 'key' | 'quota' | 'offline' | 'blocked' | 'other'
export class AiError extends Error {
  kind: AiErrorKind
  constructor(kind: AiErrorKind, message: string) { super(message); this.kind = kind }
}

async function call(path: string, key: string, init: RequestInit = {}) {
  let res: Response
  try {
    res = await fetch(`${API}/${path}`, { ...init, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...init.headers } })
  } catch {
    throw new AiError('offline', navigator.onLine === false ? 'No connection. This needs the internet.' : "Couldn't reach Google. Check your connection and try again.")
  }
  if (res.ok) return res.json()
  const body = await res.json().catch(() => null) as { error?: { message?: string; status?: string } } | null
  const msg = body?.error?.message ?? res.statusText
  if (res.status === 429) throw new AiError('quota', 'The free Gemini limit is reached for the moment. Wait a minute and try again.')
  if (res.status === 403 || (res.status === 400 && /api key/i.test(msg))) throw new AiError('key', "Google didn't accept the API key. Check it in Settings → Conversation partner.")
  if (res.status === 404) throw new AiError('other', `not-found: ${msg}`)
  throw new AiError('other', `Gemini error (${res.status}): ${msg}`)
}

// ---------- model: the newest "flash" model this key can use ----------
type ModelInfo = { name: string; supportedGenerationMethods?: string[] }

/** Pick from Google's model list instead of hard-coding a name that may be retired. Exported for tests. */
export function chooseModel(models: ModelInfo[]): string | undefined {
  const usable = models.filter(m => m.supportedGenerationMethods?.includes('generateContent'))
  const version = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0)
  const stable = usable.filter(m => /^models\/gemini-\d+(\.\d+)?-flash$/.test(m.name))
  if (stable.length) return stable.sort((a, b) => version(b.name) - version(a.name))[0].name
  const other = usable.filter(m => /flash/.test(m.name) && !/tts|image|live|audio|embed|lite|thinking|exp/.test(m.name))
  return other.sort((a, b) => version(b.name) - version(a.name))[0]?.name
}

async function pickModel(key: string) {
  const data = await call('models?pageSize=200', key) as { models?: ModelInfo[] }
  const model = chooseModel(data.models ?? [])
  if (!model) throw new AiError('other', 'No suitable Gemini model is available for this key.')
  kv.set(K.model, model)
  emit()
  return model
}

/** Check a key by listing models; saves it if it works. */
export async function connectAi(key: string) {
  const k = key.trim()
  if (!k) throw new AiError('key', 'Paste your API key first.')
  const model = await pickModel(k)
  kv.set(K.key, k)
  emit()
  return model
}

// ---------- JSON generation ----------
export type Turn = { role: 'user' | 'model'; text: string }

/** One request; the reply must match `schema` (Gemini's OpenAPI subset). */
export async function generateJson<T>(opts: { system: string; turns: Turn[]; schema: object; temperature?: number }, retried = false): Promise<T> {
  const key = aiKey()
  if (!key) throw new AiError('key', 'Connect your Gemini API key first.')
  const model = aiModel() ?? await pickModel(key)
  const generationConfig: Record<string, unknown> = { responseMimeType: 'application/json', responseSchema: opts.schema, temperature: opts.temperature ?? 0.7 }
  // 2.5 Flash "thinks" before answering by default; a chat reply should be quick.
  if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 }
  try {
    const data = await call(`${model}:generateContent`, key, {
      method: 'POST',
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: opts.turns.map(t => ({ role: t.role, parts: [{ text: t.text }] })),
        generationConfig,
      }),
    }) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] }
    const c = data.candidates?.[0]
    const text = c?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
    if (!text) throw new AiError('blocked', c?.finishReason === 'SAFETY' ? 'Gemini refused to answer that. Try saying it differently.' : 'Gemini sent an empty answer. Try again.')
    try { return JSON.parse(text) as T } catch { throw new AiError('other', 'Gemini sent an answer the app could not read. Try again.') }
  } catch (e) {
    // The saved model was retired: pick a new one once.
    if (!retried && e instanceof AiError && e.message.startsWith('not-found')) {
      kv.remove(K.model)
      return generateJson<T>(opts, true)
    }
    throw e
  }
}

/**
 * Generate, check the Portuguese for Brazilian forms, and if any, ask once more for a European rewrite.
 * Returns what's left to warn about (usually nothing).
 */
export async function generateEuropean<T>(
  generate: (fix?: string) => Promise<T>,
  portuguese: (value: T) => string[],
): Promise<{ value: T; problems: string[] }> {
  const first = await generate()
  const problems = portuguese(first).flatMap(bpProblems)
  if (!problems.length) return { value: first, problems }
  const second = await generate(`Your last answer used Brazilian Portuguese (${problems.join('; ')}). Give the same answer again in European Portuguese, as spoken in Portugal.`)
  return { value: second, problems: portuguese(second).flatMap(bpProblems) }
}

/** The rules every prompt shares, so the model writes Portuguese from Portugal at A1 level. */
export const EUROPEAN_RULES = `Write ONLY European Portuguese as spoken in Portugal, never Brazilian Portuguese:
- "estar a + infinitivo" (estou a fazer), never the gerund after estar (estou fazendo).
- Pronouns after the verb in normal sentences (chamo-me, sinto-me), never at the start (me chamo).
- Portuguese words: pequeno-almoço, autocarro, comboio, telemóvel, casa de banho, sumo, gelado, ementa, empregado, talho, sandes, fixe, rapariga, miúdo, percebi.
- Spelling from Portugal: facto, receção, ótimo, António, económico, ténis, bebé, catorze, dezasseis, dezanove.
- Avoid "você" with strangers (use the verb alone or "o senhor / a senhora") and avoid "a gente".`
