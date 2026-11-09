import { describe, expect, it } from 'vitest'
import { lookDrill, lookPairs, pairOpen, pairQuestions } from './lookalikes'
import { rng } from './test'
import { check } from './match'

const pair = (id: string) => lookPairs.find(p => p.id === id)!

describe('look-alikes', () => {
  it('every example gives a hearing and a gap question, every word a meaning question', () => {
    for (const p of lookPairs) {
      const q = pairQuestions(p, rng(1))
      const examples = p.words.reduce((n, w) => n + w.examples.length, 0)
      expect(q.filter(x => x.type === 'listen-pick')).toHaveLength(examples)
      expect(q.filter(x => x.type === 'gap-fill')).toHaveLength(examples)
      expect(q.filter(x => x.type === 'choose')).toHaveLength(2)
      expect(new Set(q.map(x => x.id)).size).toBe(q.length)
    }
  })

  it('hearing: the twin swaps only the look-alike and keeps the capital', () => {
    const q = pairQuestions(pair('esta'), rng(2)).find(x => x.id === 'lk-esta-01-hear')!
    if (q.type !== 'listen-pick') throw new Error('expected listen-pick')
    expect(q.options[q.answer]).toBe('Está bem, até logo!')
    expect(q.options).toContain('Esta bem, até logo!')
  })

  it('gap: both spellings as options, and only the exact one is right', () => {
    const q = pairQuestions(pair('e'), rng(3)).find(x => x.id === 'lk-e-00-gap')!
    if (q.type !== 'gap-fill') throw new Error('expected gap-fill')
    expect(q.pt).toBe('O café ___ bom.')
    expect([...q.options!].sort()).toEqual(['e', 'é'])
    expect(check('e', q.answers, { strict: true }).ok).toBe(false)
    expect(check('é', q.answers, { strict: true }).ok).toBe(true)
  })

  it('opens with the unit’s Key phrases; the drill only uses what it is given', () => {
    expect(pairOpen(pair('e'), new Set(['0:phrases']))).toBe(true)
    expect(pairOpen(pair('avo'), new Set(['0:phrases']))).toBe(false)
    const d = lookDrill([pair('e')], 15, 4)
    expect(d.length).toBeGreaterThan(0)
    expect(d.every(x => x.id.startsWith('lk-e-'))).toBe(true)
  })
})
