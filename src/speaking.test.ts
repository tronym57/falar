import { describe, expect, it } from 'vitest'
import { bestMatch, matchWords, SPEAK_PASS } from './speakMatch'
import { speakingQuestions, lessonQuestions, generateTest } from './test'
import { a1Content } from './content'

const unit0 = a1Content[0]

describe('matchWords', () => {
  it('ignores case, accents, punctuation and word order', () => {
    const m = matchWords('Desculpe, não percebi.', 'nao percebi desculpe')
    expect(m.score).toBe(1)
    expect(m.words.map(w => w.word)).toEqual(['Desculpe', 'não', 'percebi'])
  })

  it('marks the missing words', () => {
    const m = matchWords('Pode repetir mais devagar, por favor?', 'pode repetir por favor')
    expect(m.words.filter(w => !w.ok).map(w => w.word)).toEqual(['mais', 'devagar'])
    expect(m.score).toBeCloseTo(4 / 6)
  })

  it('counts each heard word once', () => {
    expect(matchWords('Bom dia, bom dia', 'bom dia').score).toBe(0.5)
  })

  it('lets long words be one letter off (names, recognition spelling)', () => {
    expect(matchWords('Chamo-me Patrick.', 'chamo-me Patric').score).toBe(1)
    expect(matchWords('Quanto custa?', 'quanto custo').score).toBe(1)
    expect(matchWords('Sou alemão.', 'sou alemã').score).toBe(1)
    expect(matchWords('Bom dia', 'bom dói').score).toBe(0.5) // short words must be exact
  })

  it('splits hyphenated forms, since recognition often drops the hyphen', () => {
    expect(matchWords('Chamo-me Ana', 'chamo me ana').score).toBe(1)
  })
})

describe('bestMatch', () => {
  it('takes the best over accepted answers and recognition alternatives', () => {
    const m = bestMatch(['Pode repetir mais devagar', 'Mais devagar, por favor'], ['mas de vagar por favor', 'mais devagar por favor'])
    expect(m.answer).toBe('Mais devagar, por favor')
    expect(m.score).toBeGreaterThanOrEqual(SPEAK_PASS)
  })
})

describe('speakingQuestions', () => {
  const q = speakingQuestions(unit0)

  it('has the prompts, then a role-play of every line that is yours', () => {
    const mine = unit0.dialogues.flatMap(d => d.lines.filter(l => d.speakers[l.speaker].me))
    expect(q).toHaveLength(unit0.speaking.length + mine.length)
    expect(q.slice(unit0.speaking.length).map(x => x.id)).toEqual(mine.map(l => `rp-${l.id}`))
  })

  it("role-play replies come with the other person's line as a cue", () => {
    const x = q.find(x => x.id === 'rp-u0-d2-02')
    expect(x).toMatchObject({ type: 'speak', cue: { audio: 'u0-d2-01', name: 'Cashier' }, answers: ['Desculpe, não percebi. Fala inglês?'] })
  })

  it('the speaking lesson keeps the dialogue order', () => {
    expect(lessonQuestions(unit0, 'speaking').map(x => x.id)).toEqual(q.map(x => x.id))
  })

  it('mixed tests can include speaking', () => {
    expect(generateTest([unit0], ['speaking'], 5, 1).every(x => x.type === 'speak')).toBe(true)
  })
})
