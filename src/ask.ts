// "Ask": a pocket helper for real-life moments. You describe a situation or type a word;
// Gemini answers live with things you can say, in a fixed line format the app can read
// while it streams, so each phrase can be played and saved to My words.
import { EUROPEAN_RULES, type Turn } from './ai'
import { kv } from './kv'

export const ASK_SYSTEM = `You help a beginner (A1) who lives in Portugal and is learning European Portuguese.
They write a situation ("at the pharmacy, I need something for a cough"), a question ("how do I say I'm running late?"),
or a word or sentence in English, German or Portuguese they want explained.

Answer in this exact line format, nothing else (no markdown, no bullets, no headings):
PT: <something they can say, or the Portuguese word/sentence>
EN: <its English meaning>
(repeat PT/EN for 1–3 options: the simplest and most useful first; for a single word, the word first, then one short example sentence)
NOTE: <optional, one short tip: politeness, pronunciation, when to use it; at most 2 NOTE lines>

Keep sentences short and natural, the way people actually speak in Portugal. Be polite with strangers.
${EUROPEAN_RULES}`

export type Block = { kind: 'say'; pt: string; en: string } | { kind: 'note'; text: string } | { kind: 'text'; text: string }

/** Read the answer so far into blocks; works on a half-finished answer while it streams. */
export function parseAnswer(text: string): Block[] {
  const out: Block[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-*•]\s*/, '').replace(/\*\*/g, '')
    if (!line) continue
    const m = line.match(/^(PT|EN|NOTE)\s*:\s*(.*)$/i)
    const tag = m?.[1].toUpperCase()
    const last = out.at(-1)
    if (tag === 'PT') out.push({ kind: 'say', pt: m![2], en: '' })
    else if (tag === 'EN' && last?.kind === 'say' && !last.en) last.en = m![2]
    else if (tag === 'NOTE') out.push({ kind: 'note', text: m![2] })
    else out.push({ kind: 'text', text: m ? m[2] : line })
  }
  return out
}

// ---------- your questions, kept on this phone ----------
export type Asked = { id: string; q: string; a: string; at: string }
const KEY = 'falar.ask.history'
const KEEP = 30

export function loadAsked(): Asked[] {
  try { return JSON.parse(kv.get(KEY) ?? '[]') as Asked[] } catch { return [] }
}
export function saveAsked(list: Asked[]) { kv.set(KEY, JSON.stringify(list.slice(0, KEEP))) }

/** The last few questions and answers (oldest first), so a follow-up like "and more polite?" works. */
export function contextTurns(list: Asked[], q: string): Turn[] {
  return [...list.slice(0, 3).reverse().flatMap(x => [{ role: 'user', text: x.q }, { role: 'model', text: x.a }] as Turn[]), { role: 'user', text: q }]
}
