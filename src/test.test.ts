import { describe, expect, it } from 'vitest'
import { a1Content } from './content'
import { generateTest, partOf, questionPool, rng, scoreByPart } from './test'

const unit0 = a1Content[0]

describe('questionPool', () => {
  it('builds questions for every part from Unit 0', () => {
    const pool = questionPool([unit0], rng(1))
    expect(pool.vocab.length).toBe((unit0.phrases.length + unit0.vocab.length) * 2)
    expect(pool.listening.length).toBeGreaterThan(unit0.phrases.length)
    expect(pool.grammar.length).toBeGreaterThanOrEqual(7)
    expect(pool.sentences.length).toBeGreaterThan(5)
  })

  it('makes multiple-choice questions with the right answer among 4 distinct options', () => {
    for (const q of questionPool([unit0], rng(2)).vocab) {
      if (q.type !== 'choose') continue
      expect(new Set(q.options).size).toBe(4)
      expect(q.prompt).toContain('“')
      expect(q.answer).toBeGreaterThanOrEqual(0)
    }
  })

  it('accepts nouns with or without the article', () => {
    const q = questionPool([unit0], rng(3)).vocab.find(x => x.id === 't-u0-v01-say')
    expect(q).toMatchObject({ type: 'translate', answers: ['o dia', 'dia'] })
  })

  it('listening questions play the phrase audio', () => {
    const q = questionPool([unit0], rng(4)).listening.find(x => x.id === 't-u0-p11-listen')
    expect(q).toMatchObject({ type: 'listen-choose', audio: 'u0-p11', pt: 'Não percebi.' })
  })
})

describe('generateTest', () => {
  it('returns the requested length without duplicates, spread over the parts', () => {
    const t = generateTest([unit0], ['vocab', 'listening', 'grammar', 'sentences'], 20, 42)
    expect(t).toHaveLength(20)
    expect(new Set(t.map(x => x.id)).size).toBe(20)
    const counts = t.reduce<Record<string, number>>((m, x) => ({ ...m, [partOf(x)]: (m[partOf(x)] ?? 0) + 1 }), {})
    expect(counts).toEqual({ vocab: 5, listening: 5, grammar: 5, sentences: 5 })
  })

  it('only uses the chosen parts', () => {
    const t = generateTest([unit0], ['grammar'], 30, 7)
    expect(t.every(x => partOf(x) === 'grammar')).toBe(true)
    expect(t.length).toBeLessThanOrEqual(30) // pool is smaller than 30
  })

  it('is reproducible with the same seed', () => {
    const a = generateTest([unit0], ['vocab'], 10, 99).map(x => x.id)
    const b = generateTest([unit0], ['vocab'], 10, 99).map(x => x.id)
    expect(a).toEqual(b)
  })
})

describe('scoreByPart', () => {
  it('counts first-try results per part', () => {
    const t = generateTest([unit0], ['vocab', 'grammar'], 4, 5)
    const firstTry = Object.fromEntries(t.map((x, i) => [x.id, i % 2 === 0]))
    const s = scoreByPart(t, firstTry)
    const total = Object.values(s).reduce((n, p) => n + p!.total, 0)
    expect(total).toBe(4)
  })
})
