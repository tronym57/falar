import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { lessonKey, markStepDone, markStepNotDone, nextStep, PASS_MARK } from './progress'

beforeEach(async () => { await Promise.all(db.tables.map(t => t.clear())) })

describe('marking steps done / not done', () => {
  it('a reading step can be marked done and undone', async () => {
    await markStepDone(0, 'dialogue', 0.9)
    expect((await db.progress.get('0:dialogue'))!.done).toBe(true)
    await markStepNotDone(0, 'dialogue')
    const p = await db.progress.get('0:dialogue')
    expect(p!.done).toBe(false)
    expect(p!.bestScore).toBe(0.9) // best score is kept
  })

  it('undoing clears half-finished practice for that step', async () => {
    const s = { queue: ['a'], total: 1, firstTry: {}, startedAt: '' }
    await db.sessions.bulkPut([{ key: '0:exercises', ...s }, { key: lessonKey(0, 'exercises'), ...s }, { key: '0:check', ...s }])
    await markStepDone(0, 'exercises', 1)
    await markStepNotDone(0, 'exercises')
    expect(await db.sessions.get('0:exercises')).toBeUndefined()
    expect(await db.sessions.get('0:check')).toBeDefined()
  })

  it('marking a step done clears its half-finished practice', async () => {
    const s = { queue: ['a'], total: 7, firstTry: { a: true }, startedAt: '' }
    await db.sessions.bulkPut([{ key: lessonKey(0, 'phrases'), ...s }, { key: '0:check', ...s }])
    await markStepDone(0, 'phrases')
    expect(await db.sessions.get(lessonKey(0, 'phrases'))).toBeUndefined()
    await markStepDone(0, 'check', 0.5) // not passed: not done, so its practice stays
    expect(await db.sessions.get('0:check')).toBeDefined()
  })

  it('an undone step becomes the next step again', async () => {
    for (const s of ['dialogue', 'phrases', 'vocab']) await markStepDone(0, s)
    expect(nextStep(0, await db.progress.toArray())!.slug).toBe('grammar')
    await markStepNotDone(0, 'phrases')
    expect(nextStep(0, await db.progress.toArray())!.slug).toBe('phrases')
  })

  it('the unit check can be done again after undoing', async () => {
    await markStepDone(0, 'check', PASS_MARK)
    await markStepNotDone(0, 'check')
    expect((await db.progress.get('0:check'))!.done).toBe(false)
    await markStepDone(0, 'check', 1)
    expect((await db.progress.get('0:check'))!.done).toBe(true)
  })
})
