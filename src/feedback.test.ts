import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('modern-screenshot', () => ({ domToJpeg: vi.fn() }))
const { gistFiles, submitFeedback } = await import('./feedback')
const { db } = await import('./db')

describe('feedback', () => {
  it('stores the note with its context, and the picture as base64 text', () => {
    const files = gistFiles({ id: 'x1', note: 'Bigger title', image: 'data:image/jpeg;base64,QUJD', context: { route: '/ask' }, createdAt: '2026-11-16T10:00:00Z' })
    expect(JSON.parse(files['x1.json'].content)).toMatchObject({ id: 'x1', note: 'Bigger title', status: 'open', context: { route: '/ask' } })
    expect(files['x1.jpg.b64'].content).toBe('QUJD')
  })
  it('keeps feedback on the phone until GitHub backup is set up', async () => {
    expect(await submitFeedback('Too many questions', 'data:image/jpeg;base64,QUJD', { route: '/' })).toBe('waiting')
    expect(await db.feedback.count()).toBe(1)
  })
})
