// Scoring a spoken answer: which words of the expected answer were heard (order doesn't matter,
// accents and punctuation don't matter, since recognition output varies). Pass at 70%.
export const SPEAK_PASS = 0.7

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const split = (s: string) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean)

// Recognition often writes numbers as digits ("15 euros"). Turn them into words so they can match.
const UNITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove']
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
export function numberWords(n: number): string {
  if (n < 20) return UNITS[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' e ' + UNITS[n % 10] : '')
  if (n === 100) return 'cem'
  return String(n).split('').map(d => UNITS[+d]).join(' ') // longer (phone numbers): digit by digit
}
// um/uma and dois/duas count as the same word: recognition can't tell which one you meant to write.
const ALIAS: Record<string, string> = { uma: 'um', duas: 'dois' }
const words = (s: string) => split(s.replace(/\d+/g, d => ` ${numberWords(+d)} `)).map(w => fold(w)).map(w => ALIAS[w] ?? w)

export type WordMatch = { word: string; ok: boolean }
export type SpeakScore = { answer: string; words: WordMatch[]; score: number }

/** Mark each word of `expected` as heard or not. */
export function matchWords(expected: string, heard: string): SpeakScore {
  const pool = words(heard)
  const result = split(expected).map(word => {
    const i = pool.indexOf(words(word)[0] ?? '')
    if (i >= 0) pool.splice(i, 1) // each heard word counts once
    return { word, ok: i >= 0 }
  })
  const score = result.length ? result.filter(w => w.ok).length / result.length : 0
  return { answer: expected, words: result, score }
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
