// Rounds: practice draws a fresh set from a bigger pool each time, so repeating a practice
// doesn't mean seeing the same questions in the same order.
// Order of preference: the ones you're struggling with, then never seen, then the longest ago.
// Struggling = wrong last time, or wrong in 2 of the last 3 tries: one lucky answer doesn't clear it.
import type { Exercise } from './content/types'
import { db } from './db'
import { rng, shuffle } from './test'

/** Per question: when it was last answered, and its last answers (newest first). */
export type History = Map<string, { at: string; recent: boolean[] }>

export async function historyFor(ids: string[]): Promise<History> {
  const rows = ids.length ? await db.attempts.where('exerciseId').anyOf(ids).toArray() : []
  rows.sort((a, b) => b.at.localeCompare(a.at))
  const h: History = new Map()
  for (const r of rows) {
    const e = h.get(r.exerciseId)
    if (!e) h.set(r.exerciseId, { at: r.at, recent: [r.correct] })
    else if (e.recent.length < 3) e.recent.push(r.correct)
  }
  return h
}

/** How many of the last 3 tries were wrong; 0 when the last one was right and at most one other was wrong. */
export function struggle(e?: { recent: boolean[] }) {
  if (!e) return 0
  const misses = e.recent.filter(ok => !ok).length
  return !e.recent[0] || misses >= 2 ? misses : 0
}

/** New order for the answer options, so the right one isn't always in the same place. */
export function freshen(x: Exercise, rand: () => number): Exercise {
  switch (x.type) {
    case 'choose': case 'listen-choose': case 'listen-pick': case 'read-choose': case 'listen-dialogue': {
      const right = x.options[x.answer]
      const options = shuffle(x.options, rand)
      return { ...x, options, answer: options.indexOf(right) }
    }
    case 'gap-fill': return x.options ? { ...x, options: shuffle(x.options, rand) } : x
    default: return x
  }
}

/** `n` questions from `pool`: the hardest for you first, then unseen, then the longest ago; shuffled. */
export function pickRound(pool: Exercise[], n: number, history: History, seed = Date.now()): Exercise[] {
  const rand = rng(seed)
  const unique = [...new Map(pool.map(x => [x.id, x])).values()]
  const hard = shuffle(unique.filter(x => struggle(history.get(x.id)) > 0), rand)
    .sort((a, b) => struggle(history.get(b.id)) - struggle(history.get(a.id)))
  const unseen = shuffle(unique.filter(x => !history.has(x.id)), rand)
  const old = shuffle(unique.filter(x => history.has(x.id) && !struggle(history.get(x.id))), rand)
    .sort((a, b) => history.get(a.id)!.at.localeCompare(history.get(b.id)!.at))
  // At most half the round is hard ones, so there's always room for something new.
  const cap = Math.ceil(n / 2)
  return shuffle([...hard.slice(0, cap), ...unseen, ...hard.slice(cap), ...old].slice(0, n), rand).map(x => freshen(x, rand))
}

/** A round with history read from your past answers. */
export async function newRound(pool: Exercise[], n: number, seed = Date.now()) {
  return pickRound(pool, n, await historyFor(pool.map(x => x.id)), seed)
}
