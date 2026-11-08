import { describe, expect, it } from 'vitest'
import { focusDrill, gapSentence, isWeakVerb, masteryFrom, verbById, verbDrill, verbOf, verbQuestions, verbs, verbWeight } from './verbs'
import { rng } from './test'

describe('verb content', () => {
  it('has 21 verbs with 5 forms each', () => {
    expect(verbs).toHaveLength(21)
    for (const v of verbs) expect(v.forms).toHaveLength(5)
  })

  it('uses European Portuguese forms', () => {
    expect(verbById.chamarse.forms).toEqual(['chamo-me', 'chamas-te', 'chama-se', 'chamamo-nos', 'chamam-se'])
    expect(verbById.ter.forms[4]).toBe('têm')
    expect(verbById.ver.forms[4]).toBe('veem')
  })
})

describe('gapSentence', () => {
  it('replaces the whole word only, keeping its case', () => {
    expect(gapSentence('A Ana é muito simpática.', 'é')).toEqual({ pt: 'A Ana ___ muito simpática.', answer: 'é' })
    expect(gapSentence('Chamo-me Miguel.', 'chamo-me')).toEqual({ pt: '___ Miguel.', answer: 'Chamo-me' })
    expect(gapSentence('O que comes?', 'come')).toBeNull()
  })
})

describe('verbQuestions', () => {
  const q = verbQuestions(verbById.ser, rng(1))

  it('makes a typing and a choosing question per person', () => {
    expect(q.type.map(x => x.type === 'conjugation' && x.answers[0])).toEqual(['sou', 'és', 'é', 'somos', 'são'])
    for (const x of q.pick) {
      if (x.type !== 'choose') throw new Error('expected choose')
      expect(new Set(x.options).size).toBe(x.options.length)
      expect(x.options.length).toBe(4)
    }
  })

  it('makes sentence gaps from the examples and one table', () => {
    expect(q.gap).toHaveLength(2)
    expect(q.table).toMatchObject({ type: 'verb-table', answers: ['sou', 'és', 'é', 'somos', 'são'] })
  })

  it('every exercise id maps back to its verb', () => {
    for (const x of [...q.type, ...q.pick, ...q.gap, q.table]) expect(verbOf(x.id)).toBe('ser')
  })
})

describe('mastery', () => {
  const at = (i: number) => `2026-11-08T10:00:${String(i).padStart(2, '0')}Z`
  it('scores the last 10 attempts per verb', () => {
    const attempts = [
      ...Array.from({ length: 5 }, (_, i) => ({ exerciseId: 'vb-ser-type-0', correct: false, at: at(i) })),
      ...Array.from({ length: 10 }, (_, i) => ({ exerciseId: 'vb-ser-pick-1', correct: true, at: at(10 + i) })),
      { exerciseId: 'vb-ir-type-0', correct: false, at: at(30) },
      { exerciseId: 'vb-ir-type-1', correct: false, at: at(31) },
      { exerciseId: 'vb-ir-type-2', correct: true, at: at(32) },
      { exerciseId: 'u0-x01', correct: false, at: at(33) }, // not a verb
    ]
    const m = masteryFrom(attempts)
    expect(m.ser).toEqual({ score: 1, seen: 15 })
    expect(m.ir.score).toBeCloseTo(1 / 3)
    expect(Object.keys(m)).toEqual(['ser', 'ir'])
    expect(isWeakVerb(m.ir)).toBe(true)
    expect(isWeakVerb(m.ser)).toBe(false)
  })

  it('weights weak verbs above unseen above mastered', () => {
    expect(verbWeight({ score: 0.3, seen: 5 })).toBeGreaterThan(verbWeight(undefined))
    expect(verbWeight(undefined)).toBeGreaterThan(verbWeight({ score: 1, seen: 10 }))
  })
})

describe('drills', () => {
  it('verbDrill returns distinct questions and favours weak verbs', () => {
    const mastery = Object.fromEntries(verbs.map(v => [v.id, { score: 1, seen: 10 }]))
    mastery.ir = { score: 0.2, seen: 10 }
    const counts: Record<string, number> = {}
    for (let seed = 1; seed <= 20; seed++) {
      const d = verbDrill(verbs, mastery, 15, seed)
      expect(new Set(d.map(x => x.id)).size).toBe(d.length)
      for (const x of d) counts[verbOf(x.id)!] = (counts[verbOf(x.id)!] ?? 0) + 1
    }
    const others = Object.entries(counts).filter(([k]) => k !== 'ir').map(([, n]) => n)
    expect(counts.ir).toBeGreaterThan(Math.max(...others))
  })

  it('focusDrill covers one verb and ends with the full table', () => {
    const d = focusDrill(verbById.estar, 3)
    expect(d.every(x => verbOf(x.id) === 'estar')).toBe(true)
    expect(d.at(-1)!.type).toBe('verb-table')
    expect(d.length).toBe(2 + 5 + 2 + 1)
  })
})
