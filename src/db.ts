import Dexie, { type EntityTable } from 'dexie'

/** A finished (or scored) unit step. */
export type StepProgress = {
  key: string // `${unit}:${step}`
  unit: number
  step: string
  done: boolean
  score?: number // 0–1, first-try correct share (exercises, check)
  bestScore?: number
  updatedAt: string
}

/** An exercise run in progress, so closing the app returns you to the same exercise. */
export type PracticeSession = {
  key: string // `${unit}:${step}`
  queue: string[] // exercise ids still to do, current first
  total: number
  firstTry: Record<string, boolean> // exercise id → right on the first try?
  startedAt: string
}

export type Attempt = {
  id?: number
  unit: number
  step: string
  exerciseId: string
  correct: boolean
  answer: string
  at: string
}

export const db = new Dexie('falar') as Dexie & {
  progress: EntityTable<StepProgress, 'key'>
  sessions: EntityTable<PracticeSession, 'key'>
  attempts: EntityTable<Attempt, 'id'>
}

db.version(1).stores({
  progress: 'key, unit',
  sessions: 'key',
  attempts: '++id, exerciseId, unit, at',
})

// Ask iOS to keep our data (granted for home-screen apps, per the spike).
navigator.storage?.persist?.().catch(() => {})
