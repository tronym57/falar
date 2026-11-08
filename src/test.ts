// Mixed tests: build a quiz across units and parts from the unit content.
import type { Exercise, Part, Unit } from './content/types'
import { verbQuestions, verbs } from './verbs'

export const PARTS: { id: Part; title: string }[] = [
  { id: 'vocab', title: 'Vocabulary & phrases' },
  { id: 'listening', title: 'Listening' },
  { id: 'grammar', title: 'Grammar' },
  { id: 'sentences', title: 'Sentences' },
  { id: 'verbs', title: 'Verbs' },
]

/** The part an exercise counts towards. */
export function partOf(x: Exercise): Part {
  if (x.part) return x.part
  if (x.type === 'listen-choose') return 'listening'
  return 'sentences'
}

/** Small seeded random generator, so tests are reproducible in unit tests. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}
function shuffle<T>(xs: T[], rand: () => number) {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** Accept a noun with or without its article: "o dia" or "dia". */
const answersFor = (pt: string) => {
  const bare = pt.replace(/^(o|a|os|as|um|uma) /, '')
  return bare !== pt ? [pt, bare] : [pt]
}

/** Every possible question per part for these units. */
export function questionPool(units: Unit[], rand: () => number): Record<Part, Exercise[]> {
  const items = units.flatMap(u => [...u.phrases, ...u.vocab])
  const meanings = [...new Set(items.map(i => i.en))]
  const distractors = (right: string) => shuffle(meanings.filter(m => m !== right), rand).slice(0, 3)
  const choice = (right: string) => {
    const options = shuffle([right, ...distractors(right)], rand)
    return { options, answer: options.indexOf(right) }
  }

  const vocab: Exercise[] = []
  const listening: Exercise[] = []
  for (const it of items) {
    vocab.push({ id: `t-${it.id}-meaning`, type: 'choose', part: 'vocab', prompt: `What does “${it.pt}” mean?`, ...choice(it.en) })
    vocab.push({ id: `t-${it.id}-say`, type: 'translate', part: 'vocab', en: it.en, answers: answersFor(it.pt) })
    listening.push({ id: `t-${it.id}-listen`, type: 'listen-choose', part: 'listening', pt: it.pt, audio: it.id, ...choice(it.en) })
  }

  const authored = units.flatMap(u => [...u.exercises, ...u.check, ...u.grammar.topics.flatMap(t => t.exercises)])
  // Verbs aren't tied to a unit: all A1 verbs are in the pool (single forms and sentences, no full tables).
  const verbPool = verbs.flatMap(v => { const q = verbQuestions(v, rand); return [...q.type, ...q.pick, ...q.gap] })
  const pool: Record<Part, Exercise[]> = { vocab, listening, grammar: [], sentences: [], verbs: verbPool }
  for (const x of authored) pool[partOf(x)].push(x)
  return pool
}

/** A test of `length` questions, spread evenly over the chosen parts. */
export function generateTest(units: Unit[], parts: Part[], length: number, seed = Date.now()): Exercise[] {
  const rand = rng(seed)
  const pool = questionPool(units, rand)
  const queues = parts.map(p => shuffle(pool[p], rand)).filter(q => q.length)
  const out: Exercise[] = []
  const seen = new Set<string>()
  // Round-robin over parts so each part gets a fair share.
  while (out.length < length && queues.some(q => q.length)) {
    for (const q of queues) {
      const x = q.shift()
      if (x && !seen.has(x.id)) { seen.add(x.id); out.push(x) }
      if (out.length >= length) break
    }
  }
  return shuffle(out, rand)
}

/** Score per part from first-try results. */
export function scoreByPart(items: Exercise[], firstTry: Record<string, boolean>) {
  const by: Partial<Record<Part, { right: number; total: number }>> = {}
  for (const x of items) {
    const p = partOf(x)
    by[p] ??= { right: 0, total: 0 }
    by[p]!.total++
    if (firstTry[x.id]) by[p]!.right++
  }
  return by
}
