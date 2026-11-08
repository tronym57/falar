import { describe, expect, it } from 'vitest'
import { check, normalize } from './match'

describe('normalize', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(normalize('  Desculpe,   não percebi! ')).toBe('desculpe não percebi')
  })
})

describe('check', () => {
  const answers = ['Desculpe, não percebi', 'Desculpa, não percebi']

  it('accepts any listed answer regardless of punctuation and case', () => {
    expect(check('desculpa não percebi', answers)).toMatchObject({ ok: true })
    expect(check('DESCULPE, NÃO PERCEBI.', answers)).toMatchObject({ ok: true, expected: 'Desculpe, não percebi' })
  })

  it('accepts missing accents but adds a note', () => {
    const r = check('desculpe nao percebi', answers)
    expect(r.ok).toBe(true)
    expect(r.ok && r.note).toMatch(/accents/)
  })

  it('accepts one typo in longer answers, with a note', () => {
    const r = check('desculpe não percebe', answers)
    expect(r.ok).toBe(true)
    expect(r.ok && r.note).toMatch(/typo/)
  })

  it('does not forgive typos in short answers', () => {
    expect(check('dua', ['dia']).ok).toBe(false)
  })

  it('rejects wrong and empty answers and returns the expected one', () => {
    expect(check('obrigado', answers)).toEqual({ ok: false, expected: 'Desculpe, não percebi' })
    expect(check('   ', answers).ok).toBe(false)
  })

  it('rejects answers that differ by a whole word', () => {
    expect(check('Pode repetir', ['Pode repetir mais devagar']).ok).toBe(false)
  })
})
