import { describe, expect, it } from 'vitest'
import { chooseModel } from './ai'
import { sceneById, scenes, systemPrompt, toTurns, type Message } from './talk'
import { toText } from './aiReading'
import { localDay, streakFrom } from './streak'
import { bpProblems } from './bp'

describe('chooseModel', () => {
  const m = (name: string, methods = ['generateContent']) => ({ name, supportedGenerationMethods: methods })
  it('picks the newest stable flash model that can generate', () => {
    expect(chooseModel([m('models/gemini-2.0-flash'), m('models/gemini-2.5-flash'), m('models/gemini-2.5-pro'), m('models/gemini-2.5-flash-preview-tts')])).toBe('models/gemini-2.5-flash')
    expect(chooseModel([m('models/gemini-3.0-flash'), m('models/gemini-2.5-flash')])).toBe('models/gemini-3.0-flash')
  })
  it('falls back to another flash model, skipping tts, image, lite and embeddings', () => {
    expect(chooseModel([m('models/gemini-2.5-flash-lite'), m('models/gemini-2.5-flash-001'), m('models/text-embedding-004', ['embedContent'])])).toBe('models/gemini-2.5-flash-001')
    expect(chooseModel([m('models/gemini-2.5-pro')])).toBeUndefined()
  })
})

describe('conversation scenes', () => {
  it('have European openings and tasks', () => {
    expect(scenes.length).toBeGreaterThanOrEqual(5)
    for (const s of scenes) expect(bpProblems(s.opening), s.id).toEqual([])
  })
  it('the prompt sets the character, formality, name and European rules', () => {
    const cafe = sceneById('cafe')!
    const p = systemPrompt(cafe, 'Patrick')
    expect(p).toContain('pastelaria in Peniche')
    expect(p).toContain('Never "você"')
    expect(p).toContain("The learner's name is Patrick.")
    expect(p).toContain('estar a + infinitivo')
    expect(p).toContain('1. Order a drink')
    expect(systemPrompt(sceneById('surfer')!, '')).toContain('with "tu"')
  })
  it('history starts with the user and alternates with the saved replies', () => {
    const msgs: Message[] = [{ who: 'ai', id: 'm0', pt: 'Bom dia!', en: 'Good morning!' }, { who: 'me', id: 'm1', text: 'Bom dia' }]
    const t = toTurns(msgs)
    expect(t.map(x => x.role)).toEqual(['user', 'model', 'user'])
    expect(JSON.parse(t[1].text).reply).toBe('Bom dia!')
  })
})

describe('AI reading texts', () => {
  const raw = {
    title: 'O café', emoji: '☕', en: 'About coffee.', level: 'A1',
    paragraphs: [{ pt: 'O café é bom.', en: 'The coffee is good.' }, { pt: '  ', en: '' }],
    glossary: [{ word: 'Café', en: 'coffee' }, { word: 'bom', en: 'good' }],
    questions: [
      { q: 'Is the coffee good?', options: ['Yes', 'No'], answer: 0 },
      { q: 'Broken', options: ['A', 'A'], answer: 0 },
      { q: 'Out of range', options: ['A', 'B'], answer: 5 },
    ],
    notes: [{ pt: 'é bom', en: 'is good' }, { pt: 'não existe', en: 'not in text' }],
  }
  it('keeps what holds together and drops the rest', () => {
    const t = toText(raw, 'coffee', new Date('2026-11-09T10:00:00Z'))
    expect(t.id).toMatch(/^ai-/)
    expect(t.paragraphs).toHaveLength(1)
    expect(t.paragraphs[0].id).toBe(`${t.id}-p1`)
    expect(t.glossary).toEqual({ café: 'coffee', bom: 'good' })
    expect(t.questions.map(q => q.q)).toEqual(['Is the coffee good?'])
    expect(t.notes?.map(n => n.pt)).toEqual(['é bom'])
    expect(t).toMatchObject({ tts: true, after: -1, topic: 'coffee' })
  })
})

describe('streakFrom', () => {
  const now = new Date(2026, 10, 9, 18, 0) // 9 Nov, local time
  const days = (...ds: number[]) => new Set(ds.map(d => localDay(new Date(2026, 10, d, 12))))
  it('counts days in a row up to today', () => {
    expect(streakFrom(days(7, 8, 9), now)).toMatchObject({ current: 3, today: true, best: 3 })
  })
  it("keeps yesterday's streak alive until today is over", () => {
    expect(streakFrom(days(7, 8), now)).toMatchObject({ current: 2, today: false })
  })
  it('a missed day breaks it, and the best run is remembered', () => {
    expect(streakFrom(days(1, 2, 3, 4, 8), now)).toMatchObject({ current: 1, today: false, best: 4 })
    expect(streakFrom(days(), now)).toMatchObject({ current: 0, best: 0 })
  })
  it('shows the last 7 days, oldest first', () => {
    const w = streakFrom(days(3, 9), now).week
    expect(w).toHaveLength(7)
    expect(w.map(d => d.done)).toEqual([true, false, false, false, false, false, true])
  })
})
