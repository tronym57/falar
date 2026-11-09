// Conversation partner: role-play scenes with Gemini playing the other person.
import { EUROPEAN_RULES, generateEuropean, generateJson, learnerName, type Turn } from './ai'
import { kv } from './kv'

export type Scene = {
  id: string
  emoji: string
  title: string
  en: string
  unit: number // the unit that teaches what you need
  character: string
  formality: 'tu' | 'polite'
  role: string // for the model: who it plays
  opening: string
  opening_en: string
  tasks: string[] // goals for the learner (English); empty = free conversation
}

const file = Object.values(import.meta.glob<{ scenes: Scene[] }>('../content/talk/scenes.json', { eager: true, import: 'default' }))[0]
export const scenes: Scene[] = file?.scenes ?? []
export const sceneById = (id: string) => scenes.find(s => s.id === id)

/** What the model returns each turn. */
export type Reply = {
  reply: string
  reply_en: string
  correction: { better: string; why: string } | null
  suggestion: { pt: string; en: string }
  tasks_done: number[]
}

export type Message =
  | { who: 'ai'; id: string; pt: string; en: string; suggestion?: { pt: string; en: string }; warn?: string[] }
  | { who: 'me'; id: string; text: string; correction?: { better: string; why: string } | null }

export type Conversation = { scene: string; messages: Message[]; tasksDone: number[]; updatedAt: string }

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    reply_en: { type: 'STRING' },
    correction: { type: 'OBJECT', nullable: true, properties: { better: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['better', 'why'] },
    suggestion: { type: 'OBJECT', properties: { pt: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['pt', 'en'] },
    tasks_done: { type: 'ARRAY', items: { type: 'INTEGER' } },
  },
  required: ['reply', 'reply_en', 'correction', 'suggestion', 'tasks_done'],
}

/** The instructions for the model. Exported for tests. */
export function systemPrompt(s: Scene, name = learnerName()) {
  const tasks = s.tasks.length
    ? `The learner's tasks in this scene:\n${s.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}\nGently steer the scene so they can do them, but let them lead.`
    : 'This is a free conversation: keep it going with simple questions about everyday life.'
  return `You are role-playing with a learner of European Portuguese at A1 level (beginner) who lives near Peniche, Portugal.
You are ${s.role}
${s.formality === 'tu' ? 'Talk to the learner with "tu".' : 'Talk to the learner politely: the verb form without a pronoun, or "o senhor". Never "você".'}
${name ? `The learner's name is ${name}.` : ''}
${tasks}

${EUROPEAN_RULES}

Level and style:
- A1: short sentences (at most 12 words), everyday words, mostly the present tense.
- One or two sentences per turn, usually ending with a question that moves the scene on.
- Stay in character and be warm and natural, like a real person in Peniche.
- The learner's messages come from speech recognition: ignore missing accents, capital letters and punctuation.
- If the learner writes English or is stuck, answer in very simple Portuguese and carry on.

Reply as JSON:
- reply: your next line, in European Portuguese.
- reply_en: its English translation.
- correction: only if the learner's LAST message has a real mistake (grammar, wrong word, a Brazilian form, tu/polite mix-up), give "better" (the corrected sentence in European Portuguese) and "why" (one short English sentence). Otherwise null. Never correct inside "reply".
- suggestion: a short, natural thing the learner could say next (pt), with English (en).
- tasks_done: the numbers of all tasks the learner has completed so far in the whole conversation (empty list if none).`
}

/** Turn the saved messages into the model's chat history. The scene starts with the pre-written opening. */
export function toTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = [{ role: 'user', text: '(The scene starts. Say your opening line.)' }]
  for (const m of messages) {
    if (m.who === 'ai') turns.push({ role: 'model', text: JSON.stringify({ reply: m.pt, reply_en: m.en, correction: null, suggestion: m.suggestion ?? { pt: '', en: '' }, tasks_done: [] }) })
    else turns.push({ role: 'user', text: m.text })
  }
  return turns
}

/** Send the learner's message and get the character's answer (checked for Brazilian forms). */
export async function sendTurn(s: Scene, messages: Message[]) {
  const turns = toTurns(messages)
  return generateEuropean<Reply>(
    fix => generateJson<Reply>({ system: systemPrompt(s), turns: fix ? [...turns, { role: 'user', text: fix }] : turns, schema: SCHEMA }),
    r => [r.reply, r.correction?.better ?? '', r.suggestion?.pt ?? ''],
  )
}

// ---------- saved on the phone, so closing the app keeps the conversation ----------
const key = (id: string) => `falar.talk.${id}`
export function newConversation(s: Scene): Conversation {
  return { scene: s.id, messages: [{ who: 'ai', id: 'm0', pt: s.opening, en: s.opening_en }], tasksDone: [], updatedAt: new Date().toISOString() }
}
export function loadConversation(s: Scene): Conversation {
  try {
    const raw = kv.get(key(s.id))
    if (raw) return JSON.parse(raw) as Conversation
  } catch { /* damaged: start fresh */ }
  return newConversation(s)
}
export const saveConversation = (c: Conversation) => kv.set(key(c.scene), JSON.stringify({ ...c, updatedAt: new Date().toISOString() }))
export const clearConversation = (id: string) => kv.remove(key(id))
