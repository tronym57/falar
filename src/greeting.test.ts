import { describe, expect, it } from 'vitest'
import { dailyPhrase, greeting, PHRASES } from './greeting'
import { bpProblems } from './bp'

const at = (h: number, d = 9) => new Date(2026, 10, d, h, 30)

describe('greeting', () => {
  it('follows the time of day', () => {
    expect(greeting('Patrick', at(8))).toBe('Bom dia, Patrick!')
    expect(greeting('Patrick', at(15))).toBe('Boa tarde, Patrick!')
    expect(greeting('Patrick', at(22))).toBe('Boa noite, Patrick!')
    expect(greeting('Patrick', at(2))).toBe('Boa noite, Patrick!')
  })
  it('works without a name', () => expect(greeting('  ', at(8))).toBe('Bom dia!'))
  it('same phrase all day, another tomorrow', () => {
    expect(dailyPhrase(at(6))).toBe(dailyPhrase(at(23)))
    expect(dailyPhrase(at(10, 9))).not.toBe(dailyPhrase(at(10, 10)))
  })
  it('phrases are European Portuguese', () => {
    for (const p of PHRASES) expect(bpProblems(p.pt)).toEqual([])
  })
})
