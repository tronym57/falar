// Loose answer checking for typed and built answers.

export type MatchResult =
  | { ok: true; note?: string; expected: string }
  | { ok: false; expected: string }

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

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

/**
 * Compare an answer against the accepted answers.
 * Exact (ignoring case/punctuation) → correct. Only accents differ → correct, with a note.
 * One typo in a longer answer → correct, with a note. Anything else → wrong.
 */
export function check(input: string, answers: string[]): MatchResult {
  const got = normalize(input)
  const expected = answers[0]
  if (!got) return { ok: false, expected }

  for (const a of answers) if (normalize(a) === got) return { ok: true, expected: a }

  for (const a of answers) {
    if (stripAccents(normalize(a)) === stripAccents(got)) {
      return { ok: true, expected: a, note: `Watch the accents: ${a}` }
    }
  }
  for (const a of answers) {
    const n = stripAccents(normalize(a))
    if (n.length > 5 && distance(n, stripAccents(got)) === 1) {
      return { ok: true, expected: a, note: `Small typo. Correct spelling: ${a}` }
    }
  }
  return { ok: false, expected }
}
