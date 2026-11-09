// Reading on any topic: Gemini writes a short A1 text in European Portuguese, in the same shape as
// the bundled texts (paragraphs + English, a meaning for every word, questions, phrases to notice).
import { EUROPEAN_RULES, generateEuropean, generateJson } from './ai'
import { db, type AiText } from './db'
import { tokens } from './content/reading'

type Raw = {
  title: string
  emoji: string
  en: string
  level: string
  paragraphs: { pt: string; en: string }[]
  glossary: { word: string; en: string }[]
  questions: { q: string; options: string[]; answer: number }[]
  notes: { pt: string; en: string }[]
}

const S = (type: string, extra: object = {}) => ({ type, ...extra })
const SCHEMA = S('OBJECT', {
  properties: {
    title: S('STRING'), emoji: S('STRING'), en: S('STRING'), level: S('STRING', { enum: ['A1', 'A1+'] }),
    paragraphs: S('ARRAY', { items: S('OBJECT', { properties: { pt: S('STRING'), en: S('STRING') }, required: ['pt', 'en'] }) }),
    glossary: S('ARRAY', { items: S('OBJECT', { properties: { word: S('STRING'), en: S('STRING') }, required: ['word', 'en'] }) }),
    questions: S('ARRAY', { items: S('OBJECT', { properties: { q: S('STRING'), options: S('ARRAY', { items: S('STRING') }), answer: S('INTEGER') }, required: ['q', 'options', 'answer'] }) }),
    notes: S('ARRAY', { items: S('OBJECT', { properties: { pt: S('STRING'), en: S('STRING') }, required: ['pt', 'en'] }) }),
  },
  required: ['title', 'emoji', 'en', 'level', 'paragraphs', 'glossary', 'questions', 'notes'],
})

const SYSTEM = `You write short reading texts for a beginner (A1) learning European Portuguese, who lives near Peniche, Portugal.

${EUROPEAN_RULES}

The text:
- 3 short paragraphs, 70 to 110 words in total, about the topic the learner asks for.
- A1: short sentences, everyday words, mostly the present tense; "ir + infinitivo" for the future is fine.
- Concrete and friendly, with a local Portuguese touch where it fits. No made-up statistics.

Return JSON:
- title: a short Portuguese title. emoji: one emoji. en: one English sentence saying what the text is about.
- level: "A1", or "A1+" if it uses a few harder structures.
- paragraphs: each with pt and its English translation en.
- glossary: EVERY different word in the paragraphs, written in lowercase exactly as it appears (each inflected form separately, hyphenated forms like chama-se as one word), with its meaning in this text in English.
- questions: 5 multiple-choice questions in English about the text, 4 options each, answer = index of the right option.
- notes: 2 to 4 multi-word phrases from the text worth noticing (copied exactly as they appear), with a short English explanation.`

/** Turn the model's answer into a reading text, dropping anything that doesn't hold together. Exported for tests. */
export function toText(raw: Raw, topic: string, now = new Date()): AiText {
  const paragraphs = (raw.paragraphs ?? []).filter(p => p.pt?.trim()).map((p, i) => ({ id: `p${i + 1}`, pt: p.pt.trim(), en: p.en?.trim() ?? '' }))
  if (paragraphs.length === 0) throw new Error('The text came back empty. Try again.')
  const all = paragraphs.map(p => p.pt).join(' ').toLowerCase()
  const glossary: Record<string, string> = {}
  for (const g of raw.glossary ?? []) if (g.word && g.en) glossary[g.word.toLowerCase().trim()] = g.en.trim()
  const questions = (raw.questions ?? [])
    .filter(q => q.q && Array.isArray(q.options) && q.options.length >= 2 && new Set(q.options).size === q.options.length && q.options[q.answer] !== undefined)
    .slice(0, 6)
    .map((q, i) => ({ id: `q${i + 1}`, q: q.q, options: q.options, answer: q.answer }))
  const id = `ai-${now.getTime().toString(36)}`
  return {
    id,
    order: 0,
    after: -1,
    tts: true,
    level: raw.level === 'A1+' ? 'A1+' : 'A1',
    emoji: raw.emoji?.trim() || '📝',
    title: raw.title?.trim() || topic,
    en: raw.en?.trim() || topic,
    paragraphs: paragraphs.map(p => ({ ...p, id: `${id}-${p.id}` })),
    glossary,
    questions,
    notes: (raw.notes ?? []).filter(n => n.pt && all.includes(n.pt.toLowerCase())),
    topic,
    createdAt: now.toISOString(),
  }
}

/** Words in the text without a meaning (the shared glossary fills most of these). */
export const missingWords = (t: AiText, known: (w: string) => boolean) =>
  [...new Set(t.paragraphs.flatMap(p => tokens(p.pt).filter(x => x.word).map(x => x.text.toLowerCase())))].filter(w => !t.glossary[w] && !known(w))

/** Write, check for Brazilian forms (one rewrite if needed), save. */
export async function createAiText(topic: string): Promise<{ text: AiText; problems: string[] }> {
  const ask = `Topic: ${topic.trim()}`
  const { value, problems } = await generateEuropean<Raw>(
    fix => generateJson<Raw>({ system: SYSTEM, turns: [{ role: 'user', text: fix ? `${ask}\n\n${fix}` : ask }], schema: SCHEMA, temperature: 0.8 }),
    r => [...(r.paragraphs ?? []).map(p => p.pt), ...(r.notes ?? []).map(n => n.pt)],
  )
  const text = toText(value, topic.trim())
  if (text.questions.length < 2) throw new Error("The questions didn't come out right. Try again.")
  await db.aiTexts.put(text)
  return { text, problems }
}

export const TOPIC_IDEAS = ['Surfing in winter', 'A day in Óbidos', 'Portuguese coffee', 'The Berlengas', 'Fishing boats in Peniche', 'Pastel de nata', 'Rain in Portugal', 'A walk on the beach']
