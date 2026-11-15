// Answer checking for typed and built answers: forgiving about accents and real typos,
// strict about grammar (a different real word, like "és" for "é" or "se" for "te", is a mistake).
import { explainSwap, isWord, personsOf, stripAccents, SUBJECTS } from './lexicon'

export type MatchResult =
  | { ok: true; note?: string; expected: string }
  | { ok: false; expected: string; note?: string }

/** Lowercase, drop punctuation, collapse spaces. Keeps accents. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

const tokens = (s: string) => normalize(s).split(' ').filter(Boolean)
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Subject pronouns are optional in Portuguese ("Sou alemão" = "Eu sou alemão"), but only with the
 * matching verb form ("tu sou" is wrong). Drops an extra one from the answer, or the expected one if
 * the answer leaves it out. Returns the two token lists lined up, and the pronoun that was added, if any.
 */
function alignSubjects(got: string[], exp: string[]) {
  const fits = (pronoun: string, verb?: string) => verb !== undefined && SUBJECTS[pronoun] !== undefined && personsOf(verb).includes(SUBJECTS[pronoun])
  const g = [...got], e = [...exp]
  let added: string | null = null
  for (let i = 0; i < Math.max(g.length, e.length); i++) {
    if (g[i] === e[i]) continue
    if (fits(g[i], g[i + 1]) && stripAccents(g[i + 1]) === stripAccents(e[i] ?? '')) { added = g[i]; g.splice(i, 1) }
    else if (fits(e[i], e[i + 1]) && stripAccents(e[i + 1]) === stripAccents(g[i] ?? '')) e.splice(i, 1)
  }
  return { g, e, added }
}

type Verdict = { kind: 'exact' | 'accents' | 'typo'; added: string | null } | { kind: 'wrong'; diffs: number; swap?: [string, string] }

/** Compare word by word. */
function compare(input: string, answer: string): Verdict {
  const { g, e, added } = alignSubjects(tokens(input), tokens(answer))
  if (g.length !== e.length) {
    // A missing space or hyphen, or one typo across words: judge the whole string, as before.
    const a = stripAccents(e.join(' ')), b = stripAccents(g.join(' '))
    if (a.replace(/[\s-]/g, '') === b.replace(/[\s-]/g, '')) return { kind: 'accents', added }
    return a.length > 5 && distance(a, b) === 1 ? { kind: 'typo', added } : { kind: 'wrong', diffs: Math.abs(g.length - e.length) + 1 }
  }
  let accents = false, typos = 0, diffs = 0
  let swap: [string, string] | undefined
  for (let i = 0; i < e.length; i++) {
    if (g[i] === e[i]) continue
    if (stripAccents(g[i]) === stripAccents(e[i])) { accents = true; continue }
    diffs++
    // A different real word is a grammar or meaning mistake, never a typo.
    if (isWord(g[i])) swap ??= [g[i], e[i]]
    else if (distance(stripAccents(g[i]), stripAccents(e[i])) === 1) typos++
    else typos += 2
  }
  if (swap || typos > 1 || (typos === 1 && e.join(' ').length <= 5)) return { kind: 'wrong', diffs, swap }
  return { kind: typos ? 'typo' : accents ? 'accents' : 'exact', added }
}

/**
 * Compare an answer against the accepted answers.
 * Exact (ignoring case/punctuation) → correct. Only accents differ → correct, with a note.
 * One real typo (not another real word) in a longer answer → correct, with a note.
 * An extra subject pronoun that fits the verb ("Eu sou alemão") → correct.
 * A different real word ("és" for "é", "se" for "te") → wrong, with a line on why.
 * `strict` (verb forms): accents and single letters ARE the point (vem/vêm, chamamo-nos), so no leniency.
 */
export function check(input: string, answers: string[], { strict = false } = {}): MatchResult {
  const got = normalize(input)
  const expected = answers[0]
  if (!got) return { ok: false, expected }

  for (const a of answers) if (normalize(a) === got) return { ok: true, expected: a }
  if (strict) return { ok: false, expected }

  const verdicts = answers.map(a => ({ a, v: compare(input, a) }))
  const rank = { exact: 0, accents: 1, typo: 2, wrong: 3 }
  const best = [...verdicts].sort((x, y) => rank[x.v.kind] - rank[y.v.kind])[0]
  const { a, v } = best
  if (v.kind !== 'wrong') {
    const pronoun = v.added && `Right. “${capital(v.added)}” is fine; people in Portugal often leave it out: ${a}`
    const note = v.kind === 'accents' ? `Watch the accents: ${a}` : v.kind === 'typo' ? `Small typo. Correct spelling: ${a}` : undefined
    return { ok: true, expected: a, ...((note || pronoun) && { note: [pronoun, note].filter(Boolean).join(' ') }) }
  }
  // Wrong: show the closest accepted answer, and explain a swapped word if that's what it was.
  const closest = verdicts.filter(x => x.v.kind === 'wrong').sort((x, y) => (x.v as { diffs: number }).diffs - (y.v as { diffs: number }).diffs)[0]
  const sv = closest.v as { swap?: [string, string] }
  return { ok: false, expected: closest.a, ...(sv.swap && { note: explainSwap(...sv.swap) }) }
}
