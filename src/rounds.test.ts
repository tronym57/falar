import { describe, expect, it } from 'vitest'
import type { Exercise } from './content/types'
import { freshen, pickRound, struggle, type History } from './rounds'
import { rng } from './test'
import { numberWord, topicPool, grammarLessonSize, stepRoundSize, TOPIC_ROUND } from './grammarPool'
import { a1Content } from './content'
import { bpProblems } from './bp'

const q = (id: string): Exercise => ({ id, type: 'choose', prompt: id, options: ['a', 'b', 'c'], answer: 0 })
const pool = Array.from({ length: 20 }, (_, i) => q(`q${i}`))
const h = (entries: [string, string, boolean[]][]): History => new Map(entries.map(([id, at, recent]) => [id, { at, recent }]))

describe('rounds', () => {
  it('a question stays "hard" until it is right twice in a row', () => {
    expect(struggle({ recent: [false] })).toBe(1)
    expect(struggle({ recent: [true, false, false] })).toBe(2) // one lucky answer doesn't clear it
    expect(struggle({ recent: [true, true, false] })).toBe(0)
    expect(struggle({ recent: [true] })).toBe(0)
  })

  it('picks hard ones first, then unseen, then the longest ago', () => {
    const seen = pool.slice(2).map((x, i): [string, string, boolean[]] => [x.id, `2026-01-${String(10 + i).padStart(2, '0')}`, [true]])
    const history = h([['q0', '2026-02-01', [false]], ...seen]) // q0 missed, q1 unseen, q2 the oldest seen
    const ids = pickRound(pool, 3, history, 1).map(x => x.id)
    expect(new Set(ids)).toEqual(new Set(['q0', 'q1', 'q2']))
  })

  it('gives at most half the round to hard ones, so something new still comes', () => {
    const history = h(pool.slice(0, 15).map(x => [x.id, '2026-01-01', [false]]))
    const ids = pickRound(pool, 8, history, 2).map(x => x.id)
    expect(ids.filter(id => Number(id.slice(1)) >= 15)).toHaveLength(4)
  })

  it('is a different set each time when nothing has been missed', () => {
    const a = pickRound(pool, 8, new Map(), 1).map(x => x.id)
    const b = pickRound(pool, 8, new Map(), 2).map(x => x.id)
    expect(a).not.toEqual(b)
  })

  it('shuffles options but keeps the right answer', () => {
    for (let s = 1; s < 10; s++) {
      const x = freshen({ id: 'x', type: 'choose', prompt: '?', options: ['right', 'w1', 'w2', 'w3'], answer: 0 }, rng(s))
      expect(x.type === 'choose' && x.options[x.answer]).toBe('right')
    }
  })
})

describe('question pools', () => {
  it('numbers in European Portuguese', () => {
    expect([14, 16, 17, 19, 21, 47, 60, 70, 100].map(numberWord)).toEqual(
      ['catorze', 'dezasseis', 'dezassete', 'dezanove', 'vinte e um', 'quarenta e sete', 'sessenta', 'setenta', 'cem'])
  })

  for (const u of Object.values(a1Content)) {
    it(`unit ${u.n}: every topic has a pool bigger than a round, valid and European`, () => {
      for (const t of u.grammar.topics) {
        const p = topicPool(u, t)
        expect(p.length, t.id).toBeGreaterThan(TOPIC_ROUND)
        expect(new Set(p.map(x => x.id)).size, t.id).toBe(p.length)
        for (const x of p) {
          if (x.type === 'gap-fill' && x.options) expect(x.options, x.id).toContain(x.answers[0])
          if (x.type === 'choose') expect(bpProblems(x.options[x.answer]), x.id).toEqual([])
          if (x.type === 'translate') expect(bpProblems(x.answers[0]), x.id).toEqual([])
        }
      }
      expect(grammarLessonSize(u)).toBe(u.grammar.topics.length * 5)
      expect(u.exercises.length).toBeGreaterThan(stepRoundSize(u, 'exercises'))
      expect(u.check.length).toBeGreaterThan(stepRoundSize(u, 'check'))
    })
  }
})
