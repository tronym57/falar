import { describe, expect, it } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import { statsFrom, duration } from './stats'
import { State } from './review'
import type { Attempt, ReviewCard } from './db'

const now = new Date(2026, 10, 15, 20, 0)
const at = (dayOffset: number, min: number) => new Date(2026, 10, 15 + dayOffset, 9, min).toISOString()
const attempt = (when: string, correct = true): Attempt => ({ unit: 0, step: 'exercises', exerciseId: 'x', correct, answer: '', at: when })
const card = (id: string, state: State, days = 0): ReviewCard => ({ id, unit: 0, addedAt: '', fsrs: { ...createEmptyCard(now), state, scheduled_days: days } })

describe('statsFrom', () => {
  it('counts time per sitting, activity per day and the answer rate', () => {
    const attempts = [attempt(at(0, 0)), attempt(at(0, 2), false), attempt(at(0, 3)), attempt(at(-1, 0)), attempt(at(-1, 30))]
    const s = statsFrom({ attempts, logs: [], cards: [], progress: [], ownWords: 2 }, now)
    // today: 30 s + 2 min + 1 min; yesterday: two sittings of 30 s each
    expect(s.minutes).toBe(5) // 4.5 min, rounded
    expect(s.days.at(-1)!.count).toBe(3)
    expect(s.days.at(-2)!.count).toBe(2)
    expect(s.thisWeek).toBe(5)
    expect(s.streak).toBe(2)
    expect(s.rightShare).toBeCloseTo(0.8)
    expect(s.ownWords).toBe(2)
  })

  it('groups a word’s two cards and leaves grammar cards out', () => {
    const cards = [
      card('u0-v01', State.Review, 30), card('u0-v01~en', State.Review, 25), // known well
      card('u0-v02', State.Review, 30), card('u0-v02~en', State.Learning), // learning
      card('u0-v03', State.New), card('u0-v03~en', State.New), // not started
      card('gx:u0-e01', State.Review, 30),
    ]
    expect(statsFrom({ attempts: [], logs: [], cards, progress: [], ownWords: 0 }, now).words).toEqual({ known: 1, learning: 1, notStarted: 1, tricky: 0 })
  })

  it('formats durations', () => {
    expect(duration(40)).toBe('40 min')
    expect(duration(60)).toBe('1 h')
    expect(duration(85)).toBe('1 h 25 min')
  })
})
