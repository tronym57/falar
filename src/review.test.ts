import { describe, expect, it } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import { askInEnglish, buildQueue, grade, intervalLabel, isWeak, preview, Rating, State } from './review'
import type { ReviewCard } from './db'

const now = new Date('2026-11-09T09:00:00Z')
const card = (id: string, patch: Partial<ReviewCard> = {}, fsrs = {}): ReviewCard => ({
  id, unit: 0, addedAt: '2026-11-08T10:00:00Z', fsrs: { ...createEmptyCard(new Date('2026-11-08T10:00:00Z')), ...fsrs }, ...patch,
})

describe('buildQueue', () => {
  it('puts due reviews first (oldest first), then new cards', () => {
    const cards = [
      card('new-1'),
      card('due-late', {}, { state: State.Review, due: new Date('2026-11-09T08:00:00Z') }),
      card('due-early', {}, { state: State.Review, due: new Date('2026-11-08T08:00:00Z') }),
      card('not-due', {}, { state: State.Review, due: new Date('2026-11-12T08:00:00Z') }),
    ]
    expect(buildQueue(cards, now)).toEqual(['due-early', 'due-late', 'new-1'])
  })

  it('caps new cards per day, counting ones already introduced today', () => {
    const fresh = Array.from({ length: 30 }, (_, i) => card(`n${String(i).padStart(2, '0')}`))
    expect(buildQueue(fresh, now, 15)).toHaveLength(15)
    const seenToday = Array.from({ length: 10 }, (_, i) =>
      card(`s${i}`, { introducedAt: '2026-11-09T07:00:00Z' }, { state: State.Review, due: new Date('2026-11-20T00:00:00Z') }))
    expect(buildQueue([...fresh, ...seenToday], now, 15)).toHaveLength(5)
  })
})

describe('scheduling', () => {
  it('pushes the due date further out for better grades', () => {
    const c = createEmptyCard(now)
    const [again, hard, good, easy] = preview(c, now).map(p => +p.due)
    expect(again).toBeLessThan(good)
    expect(hard).toBeLessThanOrEqual(good)
    expect(good).toBeLessThan(easy)
  })

  it('moves a card into review after Good, Good', () => {
    let c = createEmptyCard(now)
    c = grade(c, now, Rating.Good)
    c = grade(c, c.due, Rating.Good)
    expect(c.state).toBe(State.Review)
    expect(+c.due).toBeGreaterThan(+now + 12 * 3600_000)
  })

  it('marks a card weak after two lapses', () => {
    expect(isWeak(card('x', {}, { lapses: 2, state: State.Review }))).toBe(true)
    expect(isWeak(card('y', {}, { lapses: 0, state: State.Review }))).toBe(false)
  })
})

describe('intervalLabel', () => {
  it('formats minutes, hours, days and months', () => {
    const at = (ms: number) => new Date(+now + ms)
    expect(intervalLabel(at(60_000), now)).toBe('1m')
    expect(intervalLabel(at(10 * 60_000), now)).toBe('10m')
    expect(intervalLabel(at(3 * 3600_000), now)).toBe('3h')
    expect(intervalLabel(at(2 * 86400_000), now)).toBe('2d')
    expect(intervalLabel(at(90 * 86400_000), now)).toBe('3mo')
  })
})

describe('askInEnglish', () => {
  it('alternates direction with every review, starting Portuguese → English', () => {
    expect([0, 1, 2, 3].map(reps => askInEnglish({ ...card('x').fsrs, reps }))).toEqual([false, true, false, true])
  })
})
