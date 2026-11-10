import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addGrammarMistake, buildQueue, cardFaces, grammarExercise, showable, State, syncCards } from './review'
import { a1Content } from './content'
import { markStepDone } from './progress'

beforeEach(async () => { await Promise.all(db.tables.map(t => t.clear())) })
const ex = a1Content[0].grammar.topics[0].exercises[0]

describe('grammar you missed → daily review', () => {
  it('a missed grammar question becomes a card that is due soon', async () => {
    const now = new Date('2026-11-10T09:00:00Z')
    expect(await addGrammarMistake(ex, now)).toBe(true)
    const c = (await db.cards.get(`gx:${ex.id}`))!
    expect(c.unit).toBe(0)
    expect(c.fsrs.state).not.toBe(State.New)
    expect(grammarExercise(c)?.id).toBe(ex.id)
    expect(showable(c, cardFaces([]))).toBe(true)
    expect(buildQueue([c], new Date('2026-11-10T09:30:00Z'))).toEqual([c.id])
  })

  it('generated questions work too, and other questions are left out', async () => {
    expect(await addGrammarMistake({ id: 'num-17-word', type: 'choose', part: 'grammar', prompt: '17?', options: ['dezassete', 'sete'], answer: 0 })).toBe(true)
    expect(await addGrammarMistake({ id: 'u0-v01-meaning', type: 'choose', prompt: '?', options: ['a', 'b'], answer: 0 })).toBe(false)
    expect((await db.cards.toArray()).map(c => c.id)).toEqual(['gx:num-17-word'])
  })

  it('missing it again resets it; grammar cards get no English → Portuguese twin', async () => {
    await addGrammarMistake(ex, new Date('2026-11-01T09:00:00Z'))
    await addGrammarMistake(ex, new Date('2026-11-10T09:00:00Z'))
    const c = (await db.cards.get(`gx:${ex.id}`))!
    expect(c.fsrs.lapses + c.fsrs.reps).toBeGreaterThanOrEqual(2)
    await markStepDone(0, 'phrases', 1)
    await syncCards()
    expect(await db.cards.get(`gx:${ex.id}~en`)).toBeUndefined()
  })
})
