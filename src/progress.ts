import { useLiveQuery } from 'dexie-react-hooks'
import { db, type StepProgress } from './db'
import { unitSteps } from './units'
import { syncCards } from './review'

export const PASS_MARK = 0.8

const key = (unit: number, step: string) => `${unit}:${step}`
const now = () => new Date().toISOString()

export async function markStepDone(unit: number, step: string, score?: number) {
  const k = key(unit, step)
  const prev = await db.progress.get(k)
  const bestScore = score === undefined ? prev?.bestScore : Math.max(score, prev?.bestScore ?? 0)
  // The unit check only counts as done once it's passed.
  const done = step === 'check' ? (bestScore ?? 0) >= PASS_MARK : true
  await db.progress.put({ key: k, unit, step, done: done || !!prev?.done, score, bestScore, updatedAt: now() })
  // Finishing phrases or vocab puts those items into the daily review.
  if (step === 'phrases' || step === 'vocab') await syncCards()
}

/** Session key for practising a reading step right after it (dialogue, phrases, vocab, grammar). */
export const lessonKey = (unit: number, step: string) => `lesson-${unit}-${step}`

/**
 * Mark a step as not done, so it can be done again. Keeps the best score and review cards,
 * clears any half-finished practice for it.
 */
export async function markStepNotDone(unit: number, step: string) {
  const k = key(unit, step)
  await db.transaction('rw', db.progress, db.sessions, async () => {
    const prev = await db.progress.get(k)
    if (prev) await db.progress.put({ ...prev, done: false, updatedAt: now() })
    await db.sessions.bulkDelete([k, lessonKey(unit, step)])
  })
}

export async function logAttempt(unit: number, step: string, exerciseId: string, correct: boolean, answer: string) {
  await db.attempts.add({ unit, step, exerciseId, correct, answer, at: now() })
}

/** Progress for one unit: step slug → record. `undefined` while loading. */
export function useUnitProgress(unit: number) {
  return useLiveQuery(async () => {
    const rows = await db.progress.where('unit').equals(unit).toArray()
    return Object.fromEntries(rows.map(r => [r.step, r])) as Record<string, StepProgress>
  }, [unit])
}

/** All progress rows plus open sessions; used by Home and Course. */
export function useAllProgress() {
  return useLiveQuery(async () => ({
    progress: await db.progress.toArray(),
    sessions: await db.sessions.toArray(),
  }))
}

/** First step in the unit that isn't done yet and has a screen. */
export function nextStep(unit: number, progress: StepProgress[]) {
  const done = new Set(progress.filter(p => p.unit === unit && p.done).map(p => p.step))
  return unitSteps.find(s => s.ready && !done.has(s.slug))
}

export function unitDoneCount(unit: number, progress: StepProgress[]) {
  return progress.filter(p => p.unit === unit && p.done).length
}

/** Units open in order: Unit N once Unit N-1's check is passed (you can still open it early). */
export function unitUnlocked(unit: number, progress: StepProgress[]) {
  return unit === 0 || progress.some(p => p.unit === unit - 1 && p.step === 'check' && p.done)
}
