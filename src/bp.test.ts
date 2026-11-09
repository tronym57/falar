import { describe, expect, it } from 'vitest'
import { bpProblems } from './bp'

describe('bpProblems', () => {
  it('flags Brazilian words and forms', () => {
    expect(bpProblems('Estou fazendo o café da manhã.')).toHaveLength(2)
    expect(bpProblems('Me chamo Ana.')).toHaveLength(1)
    expect(bpProblems('Pode trazer o cardápio?')[0]).toContain('ementa')
  })

  it('accepts European Portuguese', () => {
    for (const t of ['Estou a fazer o pequeno-almoço.', 'Chamo-me Ana.', 'Não é português, pois não?', 'Se faz favor.', 'Pode trazer a ementa?'])
      expect(bpProblems(t), t).toEqual([])
  })
})
