import { describe, expect, it } from 'vitest'
import { practiceUnits, unitsLabel } from './openPractice'
import type { PracticeSession } from './db'
import type { Exercise } from './content/types'

const session = (key: string, ids: string[]): PracticeSession =>
  ({ key, queue: ids, total: ids.length, firstTry: {}, startedAt: '', items: ids.map(id => ({ id }) as Exercise) })

describe('practiceUnits', () => {
  it('reads units from question ids and grammar keys', () => {
    expect(practiceUnits(session('listening', ['lp-u0-p09', 'ld-u0-d1-01', 'lq-u2-d2-q2']))).toEqual([0, 2])
    expect(practiceUnits(session('drill:u1-t1', ['u1-gx01']))).toEqual([1])
    expect(practiceUnits(session('drill:u2-t1', ['gen-u2-v02-o', 'gen-u0-v11-o']))).toEqual([2])
  })
  it('is empty when the title names the unit, or nothing is tied to a unit', () => {
    expect(practiceUnits(session('lesson-0-phrases', ['l-u0-p17-meaning']))).toEqual([])
    expect(practiceUnits(session('0:exercises', ['u0-x16']))).toEqual([])
    expect(practiceUnits(session('lookalikes', ['lk-e-00-hear']))).toEqual([])
  })
})

describe('unitsLabel', () => {
  it('names one unit, a run, or a list', () => {
    expect(unitsLabel([])).toBe('')
    expect(unitsLabel([1])).toBe('Unit 1')
    expect(unitsLabel([0, 1, 2])).toBe('Units 0–2')
    expect(unitsLabel([0, 2])).toBe('Units 0, 2')
  })
})
