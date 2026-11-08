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

/** A word or phrase in spaced repetition. `fsrs` is the ts-fsrs Card (dates stay Date objects). */
export type ReviewCard = {
  id: string // content item id (u0-v01, u0-p03) or my-… for your own words
  unit: number // -1 for your own words
  fsrs: import('ts-fsrs').Card
  addedAt: string
  introducedAt?: string // first time it was shown in a review
}

export type ReviewLog = { id?: number; cardId: string; rating: number; at: string }

/** A word you added yourself. */
export type CustomWord = { id: string; pt: string; en: string; addedAt: string }

export const db = new Dexie('falar') as Dexie & {
  progress: EntityTable<StepProgress, 'key'>
  sessions: EntityTable<PracticeSession, 'key'>
  attempts: EntityTable<Attempt, 'id'>
  cards: EntityTable<ReviewCard, 'id'>
  reviewLogs: EntityTable<ReviewLog, 'id'>
  customWords: EntityTable<CustomWord, 'id'>
}

db.version(1).stores({
  progress: 'key, unit',
  sessions: 'key',
  attempts: '++id, exerciseId, unit, at',
})
db.version(2).stores({
  cards: 'id, unit',
  reviewLogs: '++id, cardId, at',
  customWords: 'id, addedAt',
})

// Ask iOS to keep our data (granted for home-screen apps, per the spike).
navigator.storage?.persist?.().catch(() => {})
