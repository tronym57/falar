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
    const r = check('desculpe não percevi', answers)
    expect(r.ok).toBe(true)
    expect(r.ok && r.note).toMatch(/typo/)
  })

  it('a different real word is a mistake, not a typo, and says why', () => {
    const r = check('de onde és', ['De onde é?'])
    expect(r.ok).toBe(false)
    expect(r.note).toMatch(/ser for tu \(2nd person.*“é”: ele\/ela\/você \(3rd person/)
    const r2 = check('como se chamas', ['Como te chamas?', 'Como se chama?'])
    expect(r2).toMatchObject({ ok: false, expected: 'Como te chamas?' })
    expect(r2.note).toMatch(/“se” is for ele\/ela\/você \(3rd person.*Here it’s “te”: tu \(2nd person, informal “you”\)/)
    expect(check('desculpe não percebe', answers).ok).toBe(false) // percebe (present) ≠ percebi (past)
  })

  it('accepts a subject pronoun that fits the verb, and leaving one out', () => {
    const r = check('eu sou alemão', ['Sou alemão.'])
    expect(r).toMatchObject({ ok: true, expected: 'Sou alemão.' })
    expect(r.ok && r.note).toMatch(/“Eu” is fine/)
    expect(check('sou alemão', ['Eu sou alemão.']).ok).toBe(true)
    expect(check('tu sou alemão', ['Sou alemão.']).ok).toBe(false)
    expect(check('eu sou alemao', ['Sou alemão.']).ok).toBe(true)
  })

  it('does not forgive typos in short answers', () => {
    expect(check('dua', ['dia']).ok).toBe(false)
  })

  it('rejects wrong and empty answers and returns the expected one', () => {
    expect(check('obrigado', answers)).toEqual({ ok: false, expected: 'Desculpe, não percebi' })
    expect(check('   ', answers).ok).toBe(false)
  })

  it('strict mode (verbs) does not forgive accents or single letters', () => {
    expect(check('chamamos-nos', ['chamamo-nos'], { strict: true }).ok).toBe(false)
    expect(check('vem', ['vêm'], { strict: true }).ok).toBe(false)
    expect(check('Chamo-me', ['chamo-me'], { strict: true }).ok).toBe(true)
  })

  it('rejects answers that differ by a whole word', () => {
    expect(check('Pode repetir', ['Pode repetir mais devagar']).ok).toBe(false)
  })
})
