import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'
import { a1Content } from './content'
import { db, type CustomWord, type ReviewCard } from './db'

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

// ---------- pure scheduling helpers (unit-tested) ----------
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Today's review queue: cards already in review that are due, then new cards
 * up to the daily limit (minus new cards already introduced today).
 */
export function buildQueue(cards: ReviewCard[], now: Date, newPerDay = NEW_PER_DAY): string[] {
  const due = cards
    .filter(c => c.fsrs.state !== State.New && new Date(c.fsrs.due) <= now)
    .sort((a, b) => +new Date(a.fsrs.due) - +new Date(b.fsrs.due))
  const introducedToday = cards.filter(c => c.introducedAt && c.introducedAt.slice(0, 10) === dayKey(now)).length
  const fresh = cards
    .filter(c => c.fsrs.state === State.New)
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, newPerDay - introducedToday))
  return [...due.map(c => c.id), ...fresh.map(c => c.id)]
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
/** Make sure every phrase/vocab item from finished steps is a review card. */
export async function syncCards() {
  const done = await db.progress.filter(p => p.done && (p.step === 'phrases' || p.step === 'vocab')).toArray()
  const existing = new Set(await db.cards.toCollection().primaryKeys())
  const now = new Date()
  const toAdd: ReviewCard[] = []
  for (const p of done) {
    const u = a1Content[p.unit]
    if (!u) continue
    for (const item of p.step === 'phrases' ? u.phrases : u.vocab) {
      if (!existing.has(item.id)) toAdd.push({ id: item.id, unit: u.n, fsrs: createEmptyCard(now), addedAt: now.toISOString() })
    }
  }
  if (toAdd.length) await db.cards.bulkAdd(toAdd)
  return toAdd.length
}

export async function addCustomWord(pt: string, en: string) {
  const now = new Date()
  const id = `my-${now.getTime().toString(36)}`
  await db.transaction('rw', db.customWords, db.cards, async () => {
    await db.customWords.add({ id, pt: pt.trim(), en: en.trim(), addedAt: now.toISOString() })
    await db.cards.add({ id, unit: -1, fsrs: createEmptyCard(now), addedAt: now.toISOString() })
  })
}

export async function deleteCustomWord(id: string) {
  await db.transaction('rw', db.customWords, db.cards, async () => {
    await db.customWords.delete(id)
    await db.cards.delete(id)
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
