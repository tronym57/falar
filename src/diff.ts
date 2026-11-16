// Word-by-word comparison of what you typed with the correct answer, to highlight exactly what differs.
import { stripAccents } from './lexicon'

/** ok: same word; accent: same word, other accents or a small slip; off: a different or missing word. */
export type Mark = 'ok' | 'accent' | 'off'
export type Piece = { text: string; mark: Mark }

const key = (w: string) => stripAccents(w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, ''))
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '')

/** One-letter slip between two words (same length change or swap), for marking it as a spelling slip. */
function near(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1 || a.length < 4) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1)
}

export function wordDiff(given: string, expected: string): { given: Piece[]; expected: Piece[] } {
  const g = given.trim().split(/\s+/).filter(Boolean)
  const e = expected.trim().split(/\s+/).filter(Boolean)
  // Longest common run of words (accents ignored), so a missing or extra word doesn't shift everything after it.
  const L = Array.from({ length: g.length + 1 }, () => new Array<number>(e.length + 1).fill(0))
  for (let i = g.length - 1; i >= 0; i--)
    for (let j = e.length - 1; j >= 0; j--)
      L[i][j] = key(g[i]) === key(e[j]) || near(key(g[i]), key(e[j])) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out = { given: [] as Piece[], expected: [] as Piece[] }
  let i = 0, j = 0
  while (i < g.length || j < e.length) {
    if (i < g.length && j < e.length && (key(g[i]) === key(e[j]) || near(key(g[i]), key(e[j]))) && L[i][j] === L[i + 1][j + 1] + 1) {
      const mark: Mark = bare(g[i]) === bare(e[j]) ? 'ok' : 'accent'
      out.given.push({ text: g[i], mark })
      out.expected.push({ text: e[j], mark })
      i++; j++
    } else if (j < e.length && (i >= g.length || L[i][j + 1] >= L[i + 1]?.[j])) {
      out.expected.push({ text: e[j++], mark: 'off' })
    } else {
      out.given.push({ text: g[i++], mark: 'off' })
    }
  }
  return out
}
