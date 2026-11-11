import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { buildQueue, grade, isTricky, isWeak, markTricky, Rating, reverseId, trickyWords } from './review'
import { pickRound } from './rounds'
import { wordOf } from './tricky'
import { a1Content } from './content'
import type { Exercise } from './content/types'

const phrase = a1Content[0].phrases[0]
const word = { id: phrase.id, unit: 0 }
beforeEach(async () => { await Promise.all(db.tables.map(t => t.clear())) })

describe('practise this more', () => {
  it('finds the word behind a question', () => {
    expect(wordOf({ id: `l-${phrase.id}-meaning`, type: 'choose', prompt: '?', options: ['a'], answer: 0 })).toEqual(word)
    expect(wordOf({ id: 'x1', type: 'translate', en: phrase.en, answers: [phrase.pt] })).toEqual(word)
    expect(wordOf({ id: 'x2', type: 'choose', prompt: '?', options: ['a'], answer: 0 })).toBeNull()
  })

  it('both cards come back in the review soon, and count as weak', async () => {
    const now = new Date('2026-11-11T10:00:00Z')
    await markTricky(word, now)
    const cards = await db.cards.toArray()
    expect(cards.map(c => c.id).sort()).toEqual([phrase.id, reverseId(phrase.id)].sort())
    expect(cards.every(c => isTricky(c) && isWeak(c))).toBe(true)
    expect(buildQueue(cards, new Date(+now + 15 * 60_000))).toHaveLength(1) // one direction per day
    expect(await trickyWords()).toEqual(new Set([phrase.id]))
  })

  it('stops being tricky once the review spaces it a week out', async () => {
    const now = new Date('2026-11-11T10:00:00Z')
    await markTricky(word, now)
    const c = (await db.cards.get(phrase.id))!
    let fsrs = c.fsrs, t = now
    for (let i = 0; i < 8 && !(fsrs.state === 2 && fsrs.scheduled_days >= 7); i++) { t = new Date(fsrs.due); fsrs = grade(fsrs, t, Rating.Good) }
    expect(isTricky({ ...c, fsrs })).toBe(false)
  })

  it('later rounds bring tricky words up first', () => {
    const q = (id: string): Exercise => ({ id, type: 'choose', prompt: id, options: ['a', 'b'], answer: 0 })
    const pool = [...Array.from({ length: 20 }, (_, i) => q(`q${i}`)), q(`t-${phrase.id}-meaning`)]
    for (let s = 1; s < 6; s++) expect(pickRound(pool, 4, new Map(), s, new Set([phrase.id])).map(x => x.id)).toContain(`t-${phrase.id}-meaning`)
  })
})
