import { describe, expect, it } from 'vitest'
import { allFirstTry, inParts, nextPart, progressOf, splitParts } from './parts'
import type { PracticeSession } from './db'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `q${i}`)
const session = (queue: string[], firstTry: Record<string, boolean> = {}): PracticeSession =>
  ({ key: 'k', queue, total: queue.length, firstTry, startedAt: '' })

describe('parts', () => {
  it('splits evenly, at most 20 each', () => {
    expect(splitParts(ids(42)).map(p => p.length)).toEqual([14, 14, 14])
    expect(splitParts(ids(21)).map(p => p.length)).toEqual([11, 10])
    expect(splitParts(ids(20))).toHaveLength(1)
  })
  it('leaves short practices alone', () => {
    const s = session(ids(12))
    expect(inParts(s)).toBe(s)
  })
  it('runs a long one part by part and keeps every answer', () => {
    let s = inParts(session(ids(42)))
    expect([s.part, s.parts, s.total]).toEqual([1, 3, 14])
    expect(progressOf(s)).toEqual({ answered: 0, total: 42 })
    s = { ...s, queue: [], firstTry: Object.fromEntries(s.queue.map(id => [id, true])) }
    s = nextPart(s)
    expect([s.part, s.total, s.queue[0]]).toEqual([2, 14, 'q14'])
    expect(progressOf(s)).toEqual({ answered: 14, total: 42 })
    expect(Object.keys(allFirstTry(s))).toHaveLength(14)
  })
  it('splits what is left of a long practice already started', () => {
    const s = inParts(session(ids(42).slice(5), Object.fromEntries(ids(5).map(id => [id, false]))))
    expect([s.parts, s.total]).toEqual([2, 19])
    expect(progressOf(s)).toEqual({ answered: 5, total: 42 })
  })
})
