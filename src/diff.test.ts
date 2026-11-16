import { describe, expect, it } from 'vitest'
import { wordDiff } from './diff'

const marks = (ps: { text: string; mark: string }[]) => ps.map(p => `${p.text}:${p.mark}`).join(' ')

describe('wordDiff', () => {
  it('marks the one wrong word on both sides', () => {
    const d = wordDiff('como se chamas', 'Como te chamas?')
    expect(marks(d.given)).toBe('como:ok se:off chamas:ok')
    expect(marks(d.expected)).toBe('Como:ok te:off chamas?:ok')
  })
  it('marks an accent slip as a slip, not a wrong word', () => {
    expect(marks(wordDiff('até jà', 'Até já!').expected)).toBe('Até:ok já!:accent')
  })
  it('handles a missing word without shifting the rest', () => {
    const d = wordDiff('sou alemão', 'Eu sou alemão.')
    expect(marks(d.expected)).toBe('Eu:off sou:ok alemão.:ok')
    expect(marks(d.given)).toBe('sou:ok alemão:ok')
  })
})
