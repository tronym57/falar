// What you've learned so far: practice only draws from unit steps you've finished.
// Finishing more steps (and units) opens more practice.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { ReadingText, Unit, Verb } from './content/types'

/** Finished steps as `${unit}:${step}`. The check only counts once passed (markStepDone handles that). */
export type DoneSteps = Set<string>

export const isDone = (done: DoneSteps, unit: number, step: string) => done.has(`${unit}:${step}`)

/** A unit's done flag: its check is passed. */
export const unitComplete = (done: DoneSteps, unit: number) => isDone(done, unit, 'check')

/**
 * The unit with only the parts you've finished: phrases after Key phrases, conversations after Dialogue,
 * and so on. Every question generator works on these, so nothing you haven't met turns up.
 */
export function learnedUnit(u: Unit, done: DoneSteps): Unit {
  const has = (step: string) => isDone(done, u.n, step)
  return {
    ...u,
    dialogues: has('dialogue') ? u.dialogues : [],
    phrases: has('phrases') ? u.phrases : [],
    vocab: has('vocab') ? u.vocab : [],
    grammar: { ...u.grammar, topics: has('grammar') ? u.grammar.topics : [] },
    exercises: has('exercises') ? u.exercises : [],
    speaking: has('speaking') ? u.speaking : [],
    check: has('check') ? u.check : [],
  }
}

/** Units with at least one finished step, trimmed to what's finished. */
export const learnedUnits = (units: Unit[], done: DoneSteps) =>
  units.filter(u => [...done].some(k => k.startsWith(`${u.n}:`))).map(u => learnedUnit(u, done))

/** A verb opens with its unit's Key phrases (where you first use it). Verbs from units not built yet stay locked. */
export const verbLearned = (v: Verb, done: DoneSteps) => isDone(done, v.unit, 'phrases')

/** A course text opens once the unit it comes after is complete. Your own AI texts are always open. */
export const textOpen = (t: ReadingText, done: DoneSteps) => t.after < 0 || unitComplete(done, t.after)

/** Locked things can still be opened (like units): ask first, then go. */
export function openAnyway(navigate: (to: string) => void, why: string, to: string) {
  if (confirm(`${why}\n\nOK opens it anyway.`)) navigate(to)
}

/** Finished steps, live. `undefined` while loading. */
export function useDone() {
  return useLiveQuery(async () => {
    const rows = await db.progress.filter(p => p.done && p.unit >= 0).toArray()
    return new Set(rows.map(r => `${r.unit}:${r.step}`)) as DoneSteps
  })
}
