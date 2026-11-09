// Look-alikes: words that differ only by an accent (é / e, avó / avô), with different meaning and sound.
import type { Exercise, LookPair, LookSet } from './content/types'
import { isDone, type DoneSteps } from './learned'
import { gapSentence } from './verbs'
import { rng } from './test'

const files = import.meta.glob<LookSet>('../content/lookalikes/*.json', { eager: true, import: 'default' })
export const lookPairs: LookPair[] = Object.values(files).flatMap(s => s.pairs)

/** A pair opens with its unit's Key phrases, like verbs. */
export const pairOpen = (p: LookPair, done: DoneSteps) => isDone(done, p.unit, 'phrases')

function shuffle<T>(xs: T[], rand: () => number) {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** The sentence with the word swapped for its look-alike, keeping a capital at the start. */
function swapped(pt: string, word: string, other: string) {
  const g = gapSentence(pt, word)
  if (!g) return null
  const cap = g.answer[0] !== g.answer[0].toLowerCase()
  return g.pt.replace('___', cap ? other[0].toUpperCase() + other.slice(1) : other)
}

/**
 * Three kinds of question per example sentence:
 * hear it and pick which spelling you heard, fill the gap with the right word, and say what the word means.
 */
export function pairQuestions(p: LookPair, rand: () => number): Exercise[] {
  const out: Exercise[] = []
  p.words.forEach((w, wi) => {
    const other = p.words[1 - wi]
    w.examples.forEach((x, k) => {
      const twin = swapped(x.pt, w.pt, other.pt)
      const g = gapSentence(x.pt, w.pt)
      if (twin) {
        const options = shuffle([x.pt, twin], rand)
        out.push({ id: `lk-${p.id}-${wi}${k}-hear`, type: 'listen-pick', part: 'listening', audio: x.id, options, answer: options.indexOf(x.pt) })
      }
      if (g) {
        out.push({ id: `lk-${p.id}-${wi}${k}-gap`, type: 'gap-fill', part: 'vocab', pt: g.pt, en: x.en, answers: [g.answer], options: shuffle([g.answer, swapped(g.answer, w.pt, other.pt) ?? other.pt], rand) })
      }
    })
    const meanings = shuffle([w.en, other.en], rand)
    out.push({ id: `lk-${p.id}-${wi}-meaning`, type: 'choose', part: 'vocab', prompt: `What does “${w.pt}” mean?`, options: meanings, answer: meanings.indexOf(w.en) })
  })
  return out
}

/** A mixed drill from the given pairs: every kind of question, shuffled, at most `n`. */
export function lookDrill(pairs: LookPair[], n = 15, seed = Date.now()): Exercise[] {
  const rand = rng(seed)
  return shuffle(pairs.flatMap(p => pairQuestions(p, rand)), rand).slice(0, n)
}
