// Long practices run in parts of at most PART_MAX questions, with a break screen between parts.
// A session keeps the parts still to come (`later`) and the first-try results of the parts done (`earlier`).
import type { PracticeSession } from './db'

export const PART_MAX = 20

/** Even parts of at most `max`: 42 → 14, 14, 14. */
export function splitParts<T>(xs: T[], max = PART_MAX): T[][] {
  const k = Math.ceil(xs.length / max)
  if (k <= 1) return [xs]
  const size = Math.ceil(xs.length / k)
  return Array.from({ length: k }, (_, i) => xs.slice(i * size, (i + 1) * size)).filter(p => p.length)
}

/** Splits a session with more than PART_MAX questions still to do; answers already given count as done. */
export function inParts(s: PracticeSession): PracticeSession {
  if (s.part) return s
  const pending = [...new Set(s.queue)]
  if (pending.length <= PART_MAX) return s
  const [first, ...later] = splitParts(pending)
  return { ...s, queue: first, total: first.length, later, part: 1, parts: later.length + 1, earlier: s.firstTry, earlierTotal: Object.keys(s.firstTry).length, firstTry: {} }
}

/** First-try results of every part so far, this one included. An answer from an earlier part wins. */
export const allFirstTry = (s: PracticeSession) => ({ ...s.firstTry, ...s.earlier })

/** Moves on to the next part. */
export function nextPart(s: PracticeSession): PracticeSession {
  const [queue, ...later] = s.later ?? []
  return { ...s, queue, total: queue.length, later, part: (s.part ?? 1) + 1, earlier: allFirstTry(s), earlierTotal: (s.earlierTotal ?? 0) + s.total, firstTry: {} }
}

/** Answered and total questions across all parts, for "14 of 42 answered". */
export function progressOf(s: PracticeSession) {
  return {
    answered: Object.keys(allFirstTry(s)).length,
    total: (s.earlierTotal ?? 0) + s.total + (s.later ?? []).reduce((n, p) => n + p.length, 0),
  }
}
