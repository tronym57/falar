import { describe, expect, it } from 'vitest'
import { a1Content } from './content'
import { generateTest, lessonQuestions, PARTS, questionPool, rng, speakingQuestions } from './test'
import { matchWords, numberWords } from './speakMatch'
import { unitUnlocked } from './progress'
import type { StepProgress } from './db'

const units = Object.values(a1Content).sort((a, b) => a.n - b.n)

describe('units 0–3', () => {
  it('all four units are loaded', () => {
    expect(units.map(u => u.n)).toEqual([0, 1, 2, 3])
  })

  for (const u of units) {
    it(`Unit ${u.n}: every lesson step builds its practice`, () => {
      for (const step of ['dialogue', 'phrases', 'vocab']) expect(lessonQuestions(u, step, 1)).toHaveLength(10)
      expect(lessonQuestions(u, 'grammar', 1).length).toBeGreaterThanOrEqual(5)
      const speak = speakingQuestions(u)
      expect(speak.length).toBeGreaterThan(u.speaking.length) // prompts + role-play
      expect(speak.filter(x => x.type === 'speak' && x.cue).length).toBeGreaterThan(0)
    })
  }

  it('a mixed test over all units has every part', () => {
    const t = generateTest(units, PARTS.map(p => p.id), 30, 4)
    expect(new Set(t.map(x => x.part ?? 'sentences')).size).toBeGreaterThanOrEqual(6)
  })

  it('accepts either form of "dois / duas" and "alemão / alemã"', () => {
    const say = questionPool(units, rng(1)).vocab.filter(x => x.type === 'translate')
    expect(say.find(x => x.id === 't-u3-v02-say')).toMatchObject({ answers: ['dois', 'duas'] })
    expect(say.find(x => x.id === 't-u1-v07-say')).toMatchObject({ answers: ['alemão', 'alemã'] })
  })
})

describe('spoken numbers', () => {
  it('writes numbers as Portuguese words', () => {
    expect([0, 15, 16, 19, 21, 48, 100].map(numberWords)).toEqual(['zero', 'quinze', 'dezasseis', 'dezanove', 'vinte e um', 'quarenta e oito', 'cem'])
    expect(numberWords(912)).toBe('nove um dois')
  })

  it('matches digits from speech recognition against words', () => {
    expect(matchWords('São quinze euros.', 'são 15 euros').score).toBe(1)
    expect(matchWords('Queria duas laranjas.', 'queria 2 laranjas').score).toBe(1)
    expect(matchWords('É o nove, um, dois, três.', 'é o 9123').score).toBe(1)
  })
})

describe('unitUnlocked', () => {
  const passed = (unit: number): StepProgress => ({ key: `${unit}:check`, unit, step: 'check', done: true, updatedAt: '' })
  it('opens a unit once the previous unit check is passed', () => {
    expect(unitUnlocked(0, [])).toBe(true)
    expect(unitUnlocked(1, [])).toBe(false)
    expect(unitUnlocked(1, [passed(0)])).toBe(true)
    expect(unitUnlocked(2, [passed(0)])).toBe(false)
  })
})
