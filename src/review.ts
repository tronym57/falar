import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'
import { a1Content } from './content'
import { db, type CustomWord, type ReviewCard } from './db'
import { useLiveQuery } from 'dexie-react-hooks'

export { Rating, State }
export type { Grade }

/** New cards introduced per day, so a review stays around 10–15 minutes. */
export const NEW_PER_DAY = 15

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }))

// ---------- what a card shows ----------
export type CardFace = { id: string; pt: string; en: string; note?: string; unit: number; custom?: boolean }

/** Look up the text for every card id: unit phrases and vocab, plus your own words. */
export function cardFaces(custom: CustomWord[]): Record<string, CardFace> {
  const faces: Record<string, CardFace> = {}
  for (const u of Object.values(a1Content)) {
    for (const p of u.phrases) faces[p.id] = { id: p.id, pt: p.pt, en: p.en, note: p.note, unit: u.n }
    for (const v of u.vocab) faces[v.id] = { id: v.id, pt: v.pt, en: v.en, note: v.note, unit: u.n }
  }
  for (const w of custom) faces[w.id] = { id: w.id, pt: w.pt, en: w.en, unit: -1, custom: true }
  return faces
}

// ---------- two cards per word ----------
// `<id>`: Portuguese → English (hear/read it, say what it means).
// `<id>~en`: English → Portuguese (see the meaning, recall the Portuguese). Each has its own schedule.
const REVERSE = '~en'
export const reverseId = (id: string) => id + REVERSE
export const isReverse = (cardId: string) => cardId.endsWith(REVERSE)
/** The word a card belongs to (the id in cardFaces). */
export const wordId = (cardId: string) => (isReverse(cardId) ? cardId.slice(0, -REVERSE.length) : cardId)
const sibling = (cardId: string) => (isReverse(cardId) ? wordId(cardId) : reverseId(cardId))

// ---------- pure scheduling helpers (unit-tested) ----------
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Today's review queue: cards already in review that are due, then new cards
 * up to the daily limit (minus new cards already introduced today).
 * The two directions of a word never both show on the same day: if both are due, one waits.
 * A word's English → Portuguese card is introduced only after its Portuguese → English card
 * was first seen on an earlier day.
 */
export function buildQueue(cards: ReviewCard[], now: Date, newPerDay = NEW_PER_DAY): string[] {
  const byId = new Map(cards.map(c => [c.id, c]))
  const today = dayKey(now)
  const queued = new Set<string>()
  // Words already reviewed today, and in which direction: the other direction waits for another day.
  const seenToday = new Map<string, string>()
  for (const c of cards) if (c.fsrs.last_review && dayKey(new Date(c.fsrs.last_review)) === today) seenToday.set(wordId(c.id), c.id)
  const out: string[] = []
  const take = (c: ReviewCard) => {
    const w = wordId(c.id)
    if (queued.has(w) || (seenToday.has(w) && seenToday.get(w) !== c.id)) return false
    queued.add(w); out.push(c.id); return true
  }
  cards
    .filter(c => c.fsrs.state !== State.New && new Date(c.fsrs.due) <= now)
    .sort((a, b) => +new Date(a.fsrs.due) - +new Date(b.fsrs.due))
    .forEach(take)

  const introducedToday = cards.filter(c => c.introducedAt && c.introducedAt.slice(0, 10) === today).length
  let room = Math.max(0, newPerDay - introducedToday)
  const ready = (c: ReviewCard) => {
    if (!isReverse(c.id)) return true
    const fwd = byId.get(sibling(c.id))
    return !!fwd && fwd.fsrs.state !== State.New && !!fwd.introducedAt && fwd.introducedAt.slice(0, 10) < today
  }
  for (const c of cards
    .filter(c => c.fsrs.state === State.New && ready(c))
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id))) {
    if (room <= 0) break
    if (take(c)) room--
  }
  return out
}

/** Short label for when a card would come back: 1m, 10m, 3h, 2d, 3mo. */
export function intervalLabel(due: Date, now: Date) {
  const min = Math.max(1, Math.round((+due - +now) / 60000))
  if (min < 60) return `${min}m`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d`
  return `${Math.round(d / 30)}mo`
}

/** What each grade would do to this card. */
export function preview(card: Card, now: Date) {
  const r = scheduler.repeat(card, now)
  return ([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]).map(g => ({ grade: g, due: r[g].card.due }))
}

export function grade(card: Card, now: Date, g: Grade) {
  return scheduler.next(card, now, g).card
}

/** "Weak": forgotten at least twice, or currently being relearned. */
export const isWeak = (c: ReviewCard) => c.fsrs.lapses >= 2 || c.fsrs.state === State.Relearning

// ---------- database ----------
/**
 * Make sure every phrase/vocab item from finished steps has both its review cards,
 * and every existing word (incl. your own) has its English → Portuguese card too.
 */
export async function syncCards() {
  const done = await db.progress.filter(p => p.done && (p.step === 'phrases' || p.step === 'vocab')).toArray()
  const cards = await db.cards.toArray()
  const existing = new Set(cards.map(c => c.id))
  const now = new Date()
  const toAdd: ReviewCard[] = []
  const add = (id: string, unit: number) => {
    if (existing.has(id)) return
    existing.add(id)
    toAdd.push({ id, unit, fsrs: createEmptyCard(now), addedAt: now.toISOString() })
  }
  for (const p of done) {
    const u = a1Content[p.unit]
    if (!u) continue
    for (const item of p.step === 'phrases' ? u.phrases : u.vocab) { add(item.id, u.n); add(reverseId(item.id), u.n) }
  }
  for (const c of cards) if (!isReverse(c.id)) add(reverseId(c.id), c.unit)
  if (toAdd.length) await db.cards.bulkAdd(toAdd)
  return toAdd.length
}

/** How many cards are due now (`count`) and how many cards exist (`total`). */
export function useDue() {
  return useLiveQuery(async () => {
    const faces = cardFaces(await db.customWords.toArray())
    const cards = (await db.cards.toArray()).filter(c => faces[wordId(c.id)])
    return { count: buildQueue(cards, new Date()).length, total: cards.length }
  })
}

export async function addCustomWord(pt: string, en: string) {
  const now = new Date()
  const id = `my-${now.getTime().toString(36)}`
  await db.transaction('rw', db.customWords, db.cards, async () => {
    await db.customWords.add({ id, pt: pt.trim(), en: en.trim(), addedAt: now.toISOString() })
    await db.cards.bulkAdd([id, reverseId(id)].map(cid => ({ id: cid, unit: -1, fsrs: createEmptyCard(now), addedAt: now.toISOString() })))
  })
}

export async function deleteCustomWord(id: string) {
  await db.transaction('rw', db.customWords, db.cards, async () => {
    await db.customWords.delete(id)
    await db.cards.bulkDelete([id, reverseId(id)])
  })
}

export async function saveGrade(card: ReviewCard, g: Grade, now = new Date()) {
  const next: ReviewCard = { ...card, fsrs: grade(card.fsrs, now, g), introducedAt: card.introducedAt ?? now.toISOString() }
  await db.transaction('rw', db.cards, db.reviewLogs, async () => {
    await db.cards.put(next)
    await db.reviewLogs.add({ cardId: card.id, rating: g, at: now.toISOString() })
  })
  return next
}
