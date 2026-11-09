// Mixed tests: build a quiz across units and parts from the unit content.
import type { Exercise, Part, ReadingText, Unit, Verb } from './content/types'
import { listeningExtras, dialogueQuestions, lineExercise } from './listening'
import { readingQuestions, readingTexts } from './content/reading'
import { verbQuestions, verbs } from './verbs'

export const PARTS: { id: Part; title: string }[] = [
  { id: 'vocab', title: 'Vocabulary & phrases' },
  { id: 'listening', title: 'Listening' },
  { id: 'grammar', title: 'Grammar' },
  { id: 'sentences', title: 'Sentences' },
  { id: 'verbs', title: 'Verbs' },
  { id: 'reading', title: 'Reading' },
  { id: 'speaking', title: 'Speaking' },
]

/** The part an exercise counts towards. */
export function partOf(x: Exercise): Part {
  if (x.part) return x.part
  if (x.type === 'read-choose') return 'reading'
  if (x.type === 'speak') return 'speaking'
  if (x.type === 'listen-choose' || x.type === 'dictation' || x.type === 'listen-pick' || x.type === 'listen-gap' || x.type === 'listen-dialogue') return 'listening'
  return 'sentences'
}

/** Small seeded random generator, so tests are reproducible in unit tests. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}
export function shuffle<T>(xs: T[], rand: () => number) {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** Accept a noun with or without its article ("o dia" or "dia"), and either form of "dois / duas". */
const answersFor = (pt: string) =>
  [...new Set(pt.split(' / ').flatMap(v => {
    const bare = v.replace(/^(o|a|os|as|um|uma) /, '')
    return bare !== v ? [v, bare] : [v]
  }))]

/** Verbs and reading texts aren't part of a unit; by default all of them are in the pool. */
export type Extras = { verbs?: Verb[]; texts?: ReadingText[] }

/** Every possible question per part for these units. */
export function questionPool(units: Unit[], rand: () => number, extras: Extras = {}): Record<Part, Exercise[]> {
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
  // Single verb forms and sentences, no full tables.
  const verbPool = (extras.verbs ?? verbs).flatMap(v => { const q = verbQuestions(v, rand); return [...q.type, ...q.pick, ...q.gap] })
  listening.push(...listeningExtras(units, rand).flat())
  const reading = (extras.texts ?? readingTexts).flatMap(readingQuestions)
  const speaking = units.filter(hasSpeaking).flatMap(u => speakingQuestions(u))
  const pool: Record<Part, Exercise[]> = { vocab, listening, grammar: [], sentences: [], verbs: verbPool, reading, speaking }
  for (const x of authored) pool[partOf(x)].push(x)
  return pool
}

/** A test of `length` questions, spread evenly over the chosen parts. */
export function generateTest(units: Unit[], parts: Part[], length: number, seed = Date.now(), extras: Extras = {}): Exercise[] {
  const rand = rng(seed)
  const pool = questionPool(units, rand, extras)
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

/**
 * Speaking: the unit's prompts ("Say you didn't understand"), then a role-play of each dialogue:
 * the other person's line plays, you answer with your line.
 */
export function speakingQuestions(unit: Unit): Exercise[] {
  const prompts: Exercise[] = unit.speaking.map(s => ({ id: `sp-${s.id}`, type: 'speak', part: 'speaking', prompt: s.prompt, answers: s.answers, pt: s.pt, audio: s.id }))
  const roleplay = unit.dialogues.flatMap(d => d.lines.flatMap((l, i): Exercise[] => {
    if (!d.speakers[l.speaker]?.me) return []
    const prev = d.lines[i - 1]
    const cue = prev && !d.speakers[prev.speaker]?.me ? { audio: prev.id, pt: prev.pt, en: prev.en, name: d.speakers[prev.speaker].name } : undefined
    return [{ id: `rp-${l.id}`, type: 'speak', part: 'speaking', prompt: l.en, answers: [l.pt], pt: l.pt, audio: l.id, cue }]
  }))
  return [...prompts, ...roleplay]
}

/** Speaking (prompts and role-play) comes with a unit's Speaking drill step: a unit trimmed to what you've learned has no prompts before it. */
const hasSpeaking = (u: Unit) => u.speaking.length > 0

/** A speaking drill across units: prompts and role-play replies, mixed. */
export function speakingDrill(units: Unit[], length: number, seed = Date.now()): Exercise[] {
  return shuffle(units.filter(hasSpeaking).flatMap(u => speakingQuestions(u)), rng(seed)).slice(0, length)
}

/** A listening-only drill that rotates through every listening style. */
export function listeningDrill(units: Unit[], length: number, seed = Date.now()): Exercise[] {
  const rand = rng(seed)
  const meaning = questionPool(units, rand).listening.filter(x => x.type === 'listen-choose')
  const queues = [meaning, ...listeningExtras(units, rand)].map(g => shuffle(g, rand)).filter(g => g.length)
  const out: Exercise[] = []
  while (out.length < length && queues.some(q => q.length)) {
    for (const q of queues) { const x = q.shift(); if (x) out.push(x); if (out.length >= length) break }
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

// ---------- practice right after a lesson ----------
export const LESSON_LENGTH = 10

/**
 * Questions built from one reading step's own content, to practise it straight away:
 * phrases / vocab → meaning, say it, hear it; dialogue → hear a line, pick its meaning;
 * grammar → the topics' own exercises.
 */
export function lessonQuestions(unit: Unit, step: string, seed = Date.now()): Exercise[] {
  const rand = rng(seed)
  const choiceFrom = (right: string, pool: string[]) => {
    const others = shuffle([...new Set(pool)].filter(m => m !== right), rand).slice(0, 3)
    const options = shuffle([right, ...others], rand)
    return { options, answer: options.indexOf(right) }
  }

  if (step === 'grammar') return shuffle(unit.grammar.topics.flatMap(t => t.exercises), rand)
  if (step === 'speaking') return speakingQuestions(unit) // in order: role-play follows the dialogue

  if (step === 'dialogue') {
    // One comprehension question per conversation, then single lines in four listening styles.
    const questions = unit.dialogues.map(d => shuffle(dialogueQuestions(d, rand), rand)[0]).filter(Boolean)
    const lines = unit.dialogues.flatMap(d => d.lines)
    const all = unit.dialogues.flatMap(d => d.lines.map(l => ({ id: l.id, pt: l.pt })))
    const meanings = lines.map(l => l.en)
    const singles = shuffle(lines, rand).slice(0, LESSON_LENGTH - questions.length).map((l, i) =>
      i % 4 === 0
        ? { id: `l-${l.id}-listen`, type: 'listen-choose', part: 'listening', pt: l.pt, audio: l.id, ...choiceFrom(l.en, meanings) } as Exercise
        : lineExercise(['pick', 'dictation', 'gap'][(i % 4) - 1] as 'pick' | 'dictation' | 'gap', l, all, rand))
    return [...questions, ...singles]
  }

  const items = step === 'phrases' ? unit.phrases : step === 'vocab' ? unit.vocab : []
  return wordQuestions(shuffle(items, rand).slice(0, LESSON_LENGTH), items.map(i => i.en), 'l', rand)
}

export type Word = { id: string; pt: string; en: string; custom?: boolean }

/**
 * Meaning / say / listen questions for a list of words, in the given order.
 * Wrong options come from `meanings`. Your own words have no recording, so they never get a listening question.
 */
export function wordQuestions(words: Word[], meanings: string[], prefix: string, rand: () => number): Exercise[] {
  const choiceFrom = (right: string) => {
    const others = shuffle([...new Set(meanings)].filter(m => m !== right), rand).slice(0, 3)
    const options = shuffle([right, ...others], rand)
    return { options, answer: options.indexOf(right) }
  }
  return words.map((it, i): Exercise => {
    const kind = i % 3 === 2 && it.custom ? 0 : i % 3
    switch (kind) {
      case 0: return { id: `${prefix}-${it.id}-meaning`, type: 'choose', part: 'vocab', prompt: `What does “${it.pt}” mean?`, ...choiceFrom(it.en) }
      case 1: return { id: `${prefix}-${it.id}-say`, type: 'translate', part: 'vocab', en: it.en, answers: answersFor(it.pt) }
      default: return { id: `${prefix}-${it.id}-listen`, type: 'listen-choose', part: 'listening', pt: it.pt, audio: it.id, ...choiceFrom(it.en) }
    }
  })
}
