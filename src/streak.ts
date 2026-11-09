// Daily streak: days in a row with any practice (lesson questions, review cards, reading,
// conversation, steps marked done). Built from data the app already keeps and backs up.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

const pad = (n: number) => String(n).padStart(2, '0')
/** The calendar day on this phone (not UTC), e.g. 2026-11-09. */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const shift = (d: Date, days: number) => { const x = new Date(d); x.setDate(x.getDate() + days); return x }

export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]

export type Streak = {
  current: number // days in a row up to today (or up to yesterday, if you haven't practised yet today)
  today: boolean // practised today
  best: number
  week: { day: string; label: string; done: boolean }[] // the last 7 days, oldest first
}

/** Pure, for tests. */
export function streakFrom(days: Set<string>, now = new Date()): Streak {
  const today = days.has(localDay(now))
  let current = 0
  for (let d = today ? now : shift(now, -1); days.has(localDay(d)); d = shift(d, -1)) current++
  let best = 0
  for (const day of days) {
    const [y, m, dd] = day.split('-').map(Number)
    const start = new Date(y, m - 1, dd)
    if (days.has(localDay(shift(start, -1)))) continue // not the start of a run
    let n = 0
    for (let d = start; days.has(localDay(d)); d = shift(d, 1)) n++
    best = Math.max(best, n)
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = shift(now, i - 6)
    return { day: localDay(d), label: d.toLocaleDateString('en', { weekday: 'narrow' }), done: days.has(localDay(d)) }
  })
  return { current, today, best, week }
}

export function useStreak() {
  return useLiveQuery(async () => {
    const days = new Set<string>()
    const add = (iso?: string) => { if (iso) days.add(localDay(new Date(iso))) }
    await db.attempts.each(a => add(a.at))
    await db.reviewLogs.each(r => add(r.at))
    await db.progress.each(p => { if (p.done) add(p.updatedAt) })
    return streakFrom(days)
  })
}
