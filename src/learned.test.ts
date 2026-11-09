import { describe, expect, it } from 'vitest'
import { a1Content } from './content'
import { readingTexts } from './content/reading'
import { learnedUnits, textOpen, verbLearned } from './learned'
import { generateTest, PARTS, questionPool, rng, speakingDrill } from './test'
import { verbs } from './verbs'

const units = Object.values(a1Content).sort((a, b) => a.n - b.n)
const ids = (xs: { id: string }[]) => xs.map(x => x.id)

describe('practice only uses finished steps', () => {
  it('nothing done: no units, no verbs, no course texts', () => {
    const done = new Set<string>()
    expect(learnedUnits(units, done)).toEqual([])
    expect(verbs.filter(v => verbLearned(v, done))).toEqual([])
    expect(readingTexts.filter(t => textOpen(t, done))).toEqual([])
  })

  it('Unit 0 phrases done: only its phrases, its verbs, nothing else', () => {
    const done = new Set(['0:phrases'])
    const learned = learnedUnits(units, done)
    expect(learned.map(u => u.n)).toEqual([0])
    const pool = questionPool(learned, rng(1), { verbs: verbs.filter(v => verbLearned(v, done)), texts: [] })
    const phraseIds = new Set(ids(a1Content[0].phrases))
    expect(pool.vocab.length).toBeGreaterThan(0)
    expect(pool.vocab.every(x => phraseIds.has(x.id.replace(/^t-/, '').replace(/-(meaning|say)$/, '')))).toBe(true)
    expect(pool.grammar).toEqual([])
    expect(pool.speaking).toEqual([])
    expect(pool.verbs.length).toBeGreaterThan(0)
    expect(pool.verbs.every(x => verbs.find(v => x.id.startsWith(`vb-${v.id}-`))!.unit === 0)).toBe(true)
  })

  it('a test never includes later units or unfinished steps', () => {
    const done = new Set(['0:dialogue', '0:phrases', '0:vocab', '0:grammar', '1:dialogue'])
    const learned = learnedUnits(units, done)
    const t = generateTest(learned, PARTS.map(p => p.id), 30, 5, { verbs: [], texts: [] })
    const later = new Set([...units.filter(u => u.n >= 2).flatMap(u => [...ids(u.phrases), ...ids(u.vocab), ...u.dialogues.flatMap(d => ids(d.lines))])])
    expect(t.length).toBeGreaterThan(0)
    expect(t.some(x => [...later].some(id => x.id.includes(id)))).toBe(false)
    expect(t.some(x => x.id.includes('u1-p'))).toBe(false) // Unit 1 phrases aren't done
    expect(speakingDrill(learned, 10, 1)).toEqual([])
  })

  it('reading texts open with their unit; verbs open with their unit’s Key phrases', () => {
    const done = new Set(['1:check', '1:phrases'])
    expect(readingTexts.filter(t => textOpen(t, done)).every(t => t.after === 1)).toBe(true)
    expect(verbs.filter(v => verbLearned(v, done)).map(v => v.id).sort()).toEqual(verbs.filter(v => v.unit === 1).map(v => v.id).sort())
  })
})
