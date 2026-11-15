// Your stats: built only from data the app already keeps (answers, review grades, cards, steps).
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Attempt, type ReviewCard, type ReviewLog, type StepProgress } from './db'
import { localDay, streakFrom } from './streak'
import { a1Content } from './content'
import { unitSteps } from './units'
import { isGrammarCard, isTricky, State, wordId } from './review'

/** Answers closer together than this count as one sitting; the gap is time spent. */
const SITTING_GAP = 5 * 60_000
/** Time credited to a sitting's first answer (reading the question). */
const FIRST_ANSWER = 30_000
/** A word is "known well" when every card for it comes back in this many days or more. */
export const KNOWN_DAYS = 21

export type Stats = {
  streak: number
  best: number
  daysPractised: number
  minutes: number
  minutesThisWeek: number
  days: { day: string; label: string; count: number }[] // last 30 days, oldest first
  thisWeek: number
  lastWeek: number
  answers: number
  rightShare: number | null
  reviews: number
  words: { known: number; learning: number; notStarted: number; tricky: number }
  ownWords: number
  steps: { done: number; total: number }
  unitsComplete: number
  unitsTotal: number
}

const shift = (d: Date, days: number) => { const x = new Date(d); x.setDate(x.getDate() + days); return x }

/** Pure, for tests. */
export function statsFrom(
  { attempts, logs, cards, progress, ownWords }: { attempts: Attempt[]; logs: ReviewLog[]; cards: ReviewCard[]; progress: StepProgress[]; ownWords: number },
  now = new Date(),
): Stats {
  const times = [...attempts.map(a => +new Date(a.at)), ...logs.map(l => +new Date(l.at))].sort((a, b) => a - b)
  const weekStart = +shift(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -6)
  let ms = 0, msWeek = 0
  times.forEach((t, i) => {
    const gap = i > 0 ? t - times[i - 1] : Infinity
    const spent = gap <= SITTING_GAP ? gap : FIRST_ANSWER
    ms += spent
    if (t >= weekStart) msWeek += spent
  })

  const perDay = new Map<string, number>()
  for (const t of times) { const k = localDay(new Date(t)); perDay.set(k, (perDay.get(k) ?? 0) + 1) }
  const activeDays = new Set(perDay.keys())
  for (const p of progress) if (p.done) activeDays.add(localDay(new Date(p.updatedAt)))
  const streak = streakFrom(activeDays, now)

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = shift(now, i - 29)
    return { day: localDay(d), label: d.toLocaleDateString('en', { day: 'numeric', month: 'short' }), count: perDay.get(localDay(d)) ?? 0 }
  })
  const sum = (from: number, to: number) => days.slice(from, to).reduce((n, d) => n + d.count, 0)

  // Words: group both cards (pt → en and en → pt) of each word; grammar cards aren't words.
  const byWord = new Map<string, ReviewCard[]>()
  for (const c of cards) if (!isGrammarCard(c.id)) byWord.set(wordId(c.id), [...(byWord.get(wordId(c.id)) ?? []), c])
  const words = { known: 0, learning: 0, notStarted: 0, tricky: 0 }
  for (const cs of byWord.values()) {
    if (cs.some(isTricky)) words.tricky++
    if (cs.every(c => c.fsrs.state === State.New)) words.notStarted++
    else if (cs.every(c => c.fsrs.state === State.Review && c.fsrs.scheduled_days >= KNOWN_DAYS)) words.known++
    else words.learning++
  }

  const units = Object.values(a1Content)
  const doneSteps = new Set(progress.filter(p => p.done && p.unit >= 0).map(p => p.key))
  const right = attempts.filter(a => a.correct).length

  return {
    streak: streak.current,
    best: streak.best,
    daysPractised: activeDays.size,
    minutes: Math.round(ms / 60_000),
    minutesThisWeek: Math.round(msWeek / 60_000),
    days,
    thisWeek: sum(23, 30),
    lastWeek: sum(16, 23),
    answers: attempts.length,
    rightShare: attempts.length ? right / attempts.length : null,
    reviews: logs.length,
    words,
    ownWords,
    steps: { done: units.reduce((n, u) => n + unitSteps.filter(s => doneSteps.has(`${u.n}:${s.slug}`)).length, 0), total: units.length * unitSteps.length },
    unitsComplete: units.filter(u => doneSteps.has(`${u.n}:check`)).length,
    unitsTotal: units.length,
  }
}

export function useStats() {
  return useLiveQuery(async () => {
    const [attempts, logs, cards, progress, ownWords] = await Promise.all([
      db.attempts.toArray(), db.reviewLogs.toArray(), db.cards.toArray(), db.progress.toArray(), db.customWords.count(),
    ])
    return statsFrom({ attempts, logs, cards, progress, ownWords })
  })
}

/** "1 h 25 min", "40 min". */
export const duration = (min: number) => min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`
