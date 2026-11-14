import { describe, expect, it } from 'vitest'
import { contextTurns, parseAnswer } from './ask'
import { openPractices, practiceTitle } from './openPractice'
import type { PracticeSession } from './db'

describe('ask', () => {
  it('reads phrases, meanings and notes, also half-way through streaming', () => {
    const a = 'PT: Tem alguma coisa para a tosse?\nEN: Do you have something for a cough?\nNOTE: Say "por favor" at the end.\nPT: Queria um xarope'
    expect(parseAnswer(a)).toEqual([
      { kind: 'say', pt: 'Tem alguma coisa para a tosse?', en: 'Do you have something for a cough?' },
      { kind: 'note', text: 'Say "por favor" at the end.' },
      { kind: 'say', pt: 'Queria um xarope', en: '' },
    ])
    expect(parseAnswer('- **PT:** Olá\n- **EN:** Hello')).toEqual([{ kind: 'say', pt: 'Olá', en: 'Hello' }])
  })

  it('sends the last few questions along, for follow-ups', () => {
    const list = [1, 2, 3, 4].map(n => ({ id: `${n}`, q: `q${n}`, a: `a${n}`, at: '' }))
    expect(contextTurns(list, 'new').map(t => t.text)).toEqual(['q3', 'a3', 'q2', 'a2', 'q1', 'a1', 'new'])
  })
})

describe('pick up where you stopped', () => {
  const s = (key: string, answered: number, at: string, route?: string): PracticeSession =>
    ({ key, queue: ['x'], total: 40, firstTry: Object.fromEntries(Array.from({ length: answered }, (_, i) => [`q${i}`, true])), startedAt: at, updatedAt: at, route })
  it('lists started practices, newest first, and knows where they run', () => {
    const open = openPractices([s('lesson-0-vocab', 12, '2026-11-10'), s('drill:u1-t2', 0, '2026-11-12'), s('vocab', 3, '2026-11-11', '/drill/run/vocab')])
    expect(open.map(x => [x.s.key, x.to])).toEqual([['vocab', '/drill/run/vocab'], ['lesson-0-vocab', '/unit/0/vocab/practice']])
    expect(practiceTitle('lesson-0-vocab')).toBe('Unit 0 · Vocabulary practice')
  })
  it('leaves out an old practice of a step done since', () => {
    const progress = [{ key: '0:vocab', unit: 0, step: 'vocab', done: true, updatedAt: '2026-11-12' }]
    expect(openPractices([s('lesson-0-vocab', 2, '2026-11-10')], progress)).toEqual([])
  })
})
