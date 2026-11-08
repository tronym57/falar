import { describe, expect, it } from 'vitest'
import { meaning, readingQuestions, readingTexts, tokens } from './content/reading'
import { a1Content } from './content'
import { generateTest, partOf } from './test'

describe('reading texts', () => {
  it('loads all 8 texts in order', () => {
    expect(readingTexts.map(t => t.id)).toEqual(['r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08'])
  })

  it('splits words from punctuation, keeping hyphenated forms whole', () => {
    expect(tokens('— Estou? Pode-se nadar.')).toEqual([
      { text: '— ', word: false }, { text: 'Estou', word: true }, { text: '? ', word: false },
      { text: 'Pode-se', word: true }, { text: ' ', word: false }, { text: 'nadar', word: true }, { text: '.', word: false },
    ])
  })

  it('every tappable word has a meaning', () => {
    for (const t of readingTexts) for (const p of t.paragraphs) for (const tk of tokens(p.pt)) {
      if (tk.word) expect(meaning(t, tk.text), `${t.id}: ${tk.text}`).toBeTruthy()
    }
  })

  it('questions keep the right answer after shuffling, and shuffle the same way every time', () => {
    for (const t of readingTexts) {
      const a = readingQuestions(t)
      expect(readingQuestions(t)).toEqual(a)
      a.forEach((x, i) => {
        if (x.type !== 'read-choose') throw new Error('expected read-choose')
        expect(x.options[x.answer]).toBe(t.questions[i].options[t.questions[i].answer])
      })
    }
  })

  it('mixed tests can include reading', () => {
    const t = generateTest([a1Content[0]], ['reading'], 10, 3)
    expect(t).toHaveLength(10)
    expect(t.every(x => partOf(x) === 'reading')).toBe(true)
  })
})
