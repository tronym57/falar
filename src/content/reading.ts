import type { Exercise, ReadingText } from './types'
import { rng, shuffle } from '../test'

// Reading texts and the shared glossary, bundled at build time (validated by `npm run lint:content`).
const files = import.meta.glob<ReadingText>('../../content/reading/a1-*.json', { eager: true, import: 'default' })
const shared = Object.values(import.meta.glob<{ words: Record<string, string> }>('../../content/reading/glossary.json', { eager: true, import: 'default' }))[0]

export const readingTexts: ReadingText[] = Object.values(files).sort((a, b) => a.id.localeCompare(b.id))
export const readingById = (id: string) => readingTexts.find(t => t.id === id)

/** Split a paragraph into words (tappable) and the bits in between. Same rule as the content linter. */
export function tokens(pt: string): { text: string; word: boolean }[] {
  return pt.split(/([\p{L}]+(?:-[\p{L}]+)*)/u).filter(Boolean).map(text => ({ text, word: /^\p{L}/u.test(text) }))
}

export function meaning(t: ReadingText, word: string): string | undefined {
  const w = word.toLowerCase()
  return t.glossary[w] ?? shared.words[w]
}

/** Progress key for a text (stored like a unit step, under unit -1). */
export const readingStep = (id: string) => `reading-${id}`

/** The text's questions, with the text attached. Options are shuffled the same way every time (resuming stays consistent). */
export function readingQuestions(t: ReadingText): Exercise[] {
  const rand = rng([...t.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7))
  const paragraphs = t.paragraphs.map(p => p.pt)
  return t.questions.map(q => {
    const options = shuffle(q.options, rand)
    return { id: `rq-${q.id}`, type: 'read-choose', part: 'reading', title: t.title, paragraphs, question: q.q, options, answer: options.indexOf(q.options[q.answer]) }
  })
}
