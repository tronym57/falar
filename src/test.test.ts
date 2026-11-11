import { describe, expect, it } from 'vitest'
import { a1Content } from './content'
import { generateTest, lessonQuestions, listeningDrill, partOf, questionPool, rng, scoreByPart, wordQuestions } from './test'
import { dialogueQuestions, listenGap, listenPick } from './listening'

const unit0 = a1Content[0]

describe('questionPool', () => {
  it('builds questions for every part from Unit 0', () => {
    const pool = questionPool([unit0], rng(1))
    expect(pool.vocab.length).toBe((unit0.phrases.length + unit0.vocab.length) * 2)
    expect(pool.listening.length).toBeGreaterThan(unit0.phrases.length)
    expect(pool.grammar.length).toBeGreaterThanOrEqual(7)
    expect(pool.sentences.length).toBeGreaterThan(5)
  })

  it('makes multiple-choice questions with the right answer among 4 distinct options', () => {
    for (const q of questionPool([unit0], rng(2)).vocab) {
      if (q.type !== 'choose') continue
      expect(new Set(q.options).size).toBe(4)
      expect(q.prompt).toContain('“')
      expect(q.answer).toBeGreaterThanOrEqual(0)
    }
  })

  it('accepts nouns with or without the article', () => {
    const q = questionPool([unit0], rng(3)).vocab.find(x => x.id === 't-u0-v01-say')
    expect(q).toMatchObject({ type: 'translate', answers: ['o dia', 'dia'] })
  })

  it('listening questions play the phrase audio', () => {
    const q = questionPool([unit0], rng(4)).listening.find(x => x.id === 't-u0-p11-listen')
    expect(q).toMatchObject({ type: 'listen-choose', audio: 'u0-p11', pt: 'Não percebi.' })
  })
})

describe('generateTest', () => {
  it('returns the requested length without duplicates, spread over the parts', () => {
    const t = generateTest([unit0], ['vocab', 'listening', 'grammar', 'sentences'], 20, 42)
    expect(t).toHaveLength(20)
    expect(new Set(t.map(x => x.id)).size).toBe(20)
    const counts = t.reduce<Record<string, number>>((m, x) => ({ ...m, [partOf(x)]: (m[partOf(x)] ?? 0) + 1 }), {})
    expect(counts).toEqual({ vocab: 5, listening: 5, grammar: 5, sentences: 5 })
  })

  it('only uses the chosen parts', () => {
    const t = generateTest([unit0], ['grammar'], 30, 7)
    expect(t.every(x => partOf(x) === 'grammar')).toBe(true)
    expect(t.length).toBeLessThanOrEqual(30) // pool is smaller than 30
  })

  it('is reproducible with the same seed', () => {
    const a = generateTest([unit0], ['vocab'], 10, 99).map(x => x.id)
    const b = generateTest([unit0], ['vocab'], 10, 99).map(x => x.id)
    expect(a).toEqual(b)
  })
})

describe('scoreByPart', () => {
  it('counts first-try results per part', () => {
    const t = generateTest([unit0], ['vocab', 'grammar'], 4, 5)
    const firstTry = Object.fromEntries(t.map((x, i) => [x.id, i % 2 === 0]))
    const s = scoreByPart(t, firstTry)
    const total = Object.values(s).reduce((n, p) => n + p!.total, 0)
    expect(total).toBe(4)
  })
})

describe('lessonQuestions', () => {
  it('builds questions from the step content only: every word, 10 for the dialogue', () => {
    for (const [step, items] of [['phrases', unit0.phrases], ['vocab', unit0.vocab]] as const) {
      const q = lessonQuestions(unit0, step, 1)
      expect(q).toHaveLength(items.length * 2)
      // First half Portuguese → English, second half English → Portuguese, each word once per half.
      const n = items.length
      expect(q.slice(0, n).every(x => x.type === 'choose' || x.type === 'listen-choose')).toBe(true)
      expect(q.slice(n).every(x => x.type === 'translate')).toBe(true)
      const words = (xs: typeof q) => new Set(xs.map(x => x.id.split('-').slice(1, 3).join('-')))
      expect(words(q.slice(0, n))).toEqual(new Set(items.map(i => i.id)))
      expect(words(q.slice(n))).toEqual(new Set(items.map(i => i.id)))
    }
    const d = lessonQuestions(unit0, 'dialogue', 1)
    expect(d).toHaveLength(10)
    expect(new Set(d.map(x => x.id)).size).toBe(10)
    const vocabIds = new Set(unit0.vocab.map(v => v.id))
    for (const x of lessonQuestions(unit0, 'vocab', 2)) expect(vocabIds.has(x.id.split('-').slice(1, 3).join('-'))).toBe(true)
  })

  it('dialogue practice: one question per conversation, then lines in several listening styles', () => {
    const q = lessonQuestions(unit0, 'dialogue', 3)
    expect(q.filter(x => x.type === 'listen-dialogue')).toHaveLength(unit0.dialogues.length)
    expect(new Set(q.map(x => x.type)).size).toBeGreaterThanOrEqual(4)
    expect(q.every(x => partOf(x) === 'listening')).toBe(true)
  })

  it('grammar practice uses the topic exercises', () => {
    expect(lessonQuestions(unit0, 'grammar', 4)).toHaveLength(unit0.grammar.topics.flatMap(t => t.exercises).length)
  })
})

describe('wordQuestions', () => {
  it('mixes meaning, say and listen, but never plays audio for your own words', () => {
    const words = [
      { id: 'a', pt: 'a onda', en: 'the wave' }, { id: 'b', pt: 'a prancha', en: 'the board' },
      { id: 'c', pt: 'o mar', en: 'the sea', custom: true }, { id: 'd', pt: 'a praia', en: 'the beach' },
    ]
    const q = wordQuestions(words, words.map(w => w.en), 'w', rng(1))
    expect(q.map(x => x.type)).toEqual(['choose', 'translate', 'choose', 'choose'])
    expect(q[0].id).toBe('w-a-meaning')
  })
})

describe('listening', () => {
  const clips = [{ id: 'a', pt: 'Bom dia!' }, { id: 'b', pt: 'Boa tarde.' }, { id: 'c', pt: 'Bom dia, tudo bem?' }, { id: 'd', pt: 'Até logo!' }, { id: 'e', pt: 'Bom dia' }]

  it('pick: similar sentences first, never the same text twice', () => {
    const x = listenPick(clips[0], clips, rng(1))
    if (x.type !== 'listen-pick') throw new Error('expected listen-pick')
    expect(x.options).toHaveLength(4)
    expect(x.options[x.answer]).toBe('Bom dia!')
    expect(x.options).not.toContain('Bom dia')
    expect(x.options).toContain('Bom dia, tudo bem?')
  })

  it('gap: blanks the longest word and keeps punctuation', () => {
    expect(listenGap({ id: 'x', pt: 'Pode repetir, por favor?' })).toMatchObject({ pt: 'Pode ___, por favor?', answers: ['repetir'] })
    expect(listenGap({ id: 'y', pt: 'Olá' })).toBeNull()
  })

  it('conversation questions keep the right answer after shuffling', () => {
    for (const d of unit0.dialogues) for (const x of dialogueQuestions(d, rng(5))) {
      if (x.type !== 'listen-dialogue') throw new Error('expected listen-dialogue')
      const q = d.questions!.find(q => x.id === `lq-${q.id}`)!
      expect(x.options[x.answer]).toBe(q.options[q.answer])
      // Only the part the question is about, not the whole conversation.
      const [from, to] = q.lines!
      expect(x.clips).toEqual(d.lines.slice(from, to + 1).map(l => l.id))
      expect(x.clips.length).toBeLessThanOrEqual(5)
    }
  })

  it('listening drill rotates through all five styles', () => {
    const t = listeningDrill([unit0], 15, 2)
    expect(t).toHaveLength(15)
    expect(new Set(t.map(x => x.type))).toEqual(new Set(['listen-choose', 'listen-pick', 'dictation', 'listen-gap', 'listen-dialogue']))
  })
})

describe('wrong options', () => {
  it('look like the right one: a sentence gets sentences, a word gets words', async () => {
    const { similarTo, rng } = await import('./test')
    const pool = ['two', 'nine', 'a little bit', 'thank you', 'Where do you live?', 'I am from Germany.', 'Can you repeat, please?', 'See you tomorrow!']
    const s = similarTo("I don't speak Portuguese well yet.", pool, rng(1))
    expect(s.every(x => /[.?!]$/.test(x))).toBe(true)
    const w = similarTo('three', pool, rng(2))
    expect(w).toContain('two'); expect(w).toContain('nine')
  })
})
