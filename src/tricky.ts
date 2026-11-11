// Tricky words: right answer, but you're not sure you'll remember it. "Practise this more" marks the
// word or phrase behind a question, so it comes up more: in this round, in the daily review, and
// first in later practice rounds and the Vocabulary drill.
import type { Exercise } from './content/types'
import { a1Content } from './content'
import { translationOf } from './translation'

const items = Object.values(a1Content).flatMap(u => [...u.phrases, ...u.vocab].map(it => ({ id: it.id, pt: it.pt, unit: u.n })))
const unitOf = new Map(items.map(it => [it.id, it.unit]))
const key = (pt: string) => pt.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim()
const byPt = new Map(items.map(it => [key(it.pt), it.id]))

/** Questions made from a word carry its id: `<prefix>-<word id>-meaning|say|listen`. */
const WORD_Q = /^[a-z]+-(.+)-(meaning|say|listen)$/

/** The phrase, word or own word a question is about; `null` when it isn't about one. */
export function wordOf(ex: Exercise): { id: string; unit: number } | null {
  const m = ex.id.match(WORD_Q)
  if (m && (unitOf.has(m[1]) || m[1].startsWith('my-'))) return { id: m[1], unit: unitOf.get(m[1]) ?? -1 }
  const t = translationOf(ex)
  const id = t && byPt.get(key(t.pt))
  return id ? { id, unit: unitOf.get(id)! } : null
}

/** The kind of word question (meaning / say / listen), so extra ones can be a different kind. */
export const wordQuestionKind = (ex: Exercise) => ex.id.match(WORD_Q)?.[2] ?? null
