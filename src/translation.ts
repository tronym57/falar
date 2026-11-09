// The Portuguese sentence behind a question and its English meaning, shown after you answer
// ("Com licença = Excuse me"), so every answer also teaches what it means.
import type { Exercise } from './content/types'
import { a1Content } from './content'
import { verbs } from './verbs'

type Pair = { pt: string; en: string }

/** Every recorded line with an English meaning: phrases, words, dialogue lines, verb examples. */
const lines = [
  ...Object.values(a1Content).flatMap(u => [...u.phrases, ...u.vocab, ...u.dialogues.flatMap(d => d.lines)]),
  ...verbs.flatMap(v => v.examples),
]
const byId: Record<string, Pair> = Object.fromEntries(lines.map(x => [x.id, { pt: x.pt, en: x.en }]))
const key = (pt: string) => pt.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim()
const byPt: Record<string, Pair> = Object.fromEntries(lines.map(x => [key(x.pt), { pt: x.pt, en: x.en }]))

/** `null` when the question has no single Portuguese sentence (meanings, verb tables, reading). */
export function translationOf(ex: Exercise): Pair | null {
  switch (ex.type) {
    case 'dictation': case 'listen-gap': case 'listen-pick': case 'listen-choose':
      return byId[ex.audio ?? ex.id] ?? null
    // Role-play replies are dialogue lines; speaking prompts ("Say you didn't understand") are instructions,
    // so their meaning comes from the same sentence among the phrases, if it's there.
    case 'speak': return byId[ex.audio] ?? byPt[key(ex.pt)] ?? null
    case 'translate': return { pt: ex.answers[0], en: ex.en }
    case 'sentence-builder': return { pt: ex.answer, en: ex.en }
    case 'gap-fill': return { pt: ex.pt.replace(/_{2,}/, ex.answers[0]), en: ex.en }
    default: return null
  }
}
