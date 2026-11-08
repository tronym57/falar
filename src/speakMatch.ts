// Scoring a spoken answer: which words of the expected answer were heard (order doesn't matter,
// accents and punctuation don't matter, since recognition output varies). Pass at 70%.
export const SPEAK_PASS = 0.7

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const split = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean)

export type WordMatch = { word: string; ok: boolean }
export type SpeakScore = { answer: string; words: WordMatch[]; score: number }

/** Mark each word of `expected` as heard or not. */
export function matchWords(expected: string, heard: string): SpeakScore {
  const pool = split(fold(heard))
  const words = split(expected).map(word => {
    const i = pool.indexOf(fold(word))
    if (i >= 0) pool.splice(i, 1) // each heard word counts once
    return { word, ok: i >= 0 }
  })
  const score = words.length ? words.filter(w => w.ok).length / words.length : 0
  return { answer: expected, words, score }
}

/** Best match over all accepted answers and everything the recogniser offered. */
export function bestMatch(answers: string[], heard: string[]): SpeakScore {
  let best = matchWords(answers[0], '')
  for (const a of answers) for (const h of heard) {
    const m = matchWords(a, h)
    if (m.score > best.score) best = m
  }
  return best
}
