import { describe, expect, it } from 'vitest'
import { a1Content } from './content'
import { translationOf } from './translation'
import { dictation } from './listening'
import { speakingQuestions } from './test'

const unit0 = a1Content[0]

describe('translationOf', () => {
  it('a dictation shows the line and its meaning', () => {
    const p = unit0.phrases.find(x => x.pt === 'Com licença')!
    expect(translationOf(dictation({ id: p.id, pt: p.pt }))).toEqual({ pt: p.pt, en: p.en })
  })
  it('speaking prompts get a real meaning, not the instruction', () => {
    for (const x of speakingQuestions(unit0)) {
      const t = translationOf(x)
      if (t) expect(t.en.startsWith('Say ')).toBe(false)
    }
  })
  it('a typed translation shows what you typed it from', () => {
    expect(translationOf({ id: 'x', type: 'translate', en: 'Excuse me', answers: ['Com licença'] })).toEqual({ pt: 'Com licença', en: 'Excuse me' })
  })
})
