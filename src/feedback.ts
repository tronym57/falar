// Feedback on a screen: a screenshot, a note and what was on screen, sent to a private Gist
// ("falar-feedback") with the backup's GitHub token. Claude Code reads it with scripts/feedback.mjs.
// Items wait on the phone until they're sent (offline, or backup not set up yet).
import { domToJpeg } from 'modern-screenshot'
import { db, type Feedback } from './db'
import { gh } from './backup'
import { kv } from './kv'

const DESCRIPTION = 'falar-feedback'
const GIST = 'falar.feedback.gist'
const TOKEN = 'falar.gist.token'
/** Elements left out of the screenshot (the feedback button and sheet). */
export const NO_CAPTURE = 'no-capture'

/** The whole page (at least one screen tall) as a JPEG, without the feedback button. */
export async function capture(): Promise<string> {
  const body = document.body
  return domToJpeg(body, {
    // At least the full screen, so panels fixed to the bottom (like the answer panel) are in it on short pages.
    width: innerWidth,
    height: Math.max(body.scrollHeight, innerHeight),
    scale: Math.min(2, devicePixelRatio || 1),
    quality: 0.72,
    backgroundColor: getComputedStyle(body).backgroundColor,
    filter: n => !(n instanceof Element && n.classList.contains(NO_CAPTURE)),
  })
}

/** What was on screen, so the change can be found and checked without the picture. */
export function screenContext(): Record<string, unknown> {
  const main = document.querySelector('main')
  const ex = document.querySelector<HTMLElement>('[data-exercise]')
  return {
    route: location.hash.replace(/^#/, '') || '/',
    heading: document.querySelector('h1, h2')?.textContent?.trim() ?? null,
    exercise: ex?.dataset.exercise ?? null,
    session: ex?.dataset.session ?? null,
    scrollY: Math.round(scrollY),
    viewport: `${innerWidth}×${innerHeight}`,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    version: __APP_VERSION__,
    text: (main?.innerText ?? '').replace(/\n{2,}/g, '\n').slice(0, 3000),
  }
}

export const canSend = () => !!kv.get(TOKEN)

/** Saves an item on the phone, then tries to send everything waiting. */
export async function submitFeedback(note: string, image: string, context: Record<string, unknown>) {
  const createdAt = new Date().toISOString()
  const id = createdAt.replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-') + '-' + Math.random().toString(36).slice(2, 6)
  await db.feedback.put({ id, note, image, context, createdAt })
  return sendPending()
}

/** Files for one item in the Gist: the note with its context, and the picture as base64 text (Gists hold text). */
export function gistFiles(f: Feedback) {
  return {
    [`${f.id}.json`]: { content: JSON.stringify({ id: f.id, note: f.note, createdAt: f.createdAt, status: 'open', context: f.context }, null, 2) },
    [`${f.id}.jpg.b64`]: { content: f.image.replace(/^data:image\/\w+;base64,/, '') },
  }
}

let sending: Promise<'sent' | 'waiting'> | null = null

/** Sends waiting items one by one. 'waiting' when some are still on the phone (no backup, offline, or an error). */
export function sendPending(): Promise<'sent' | 'waiting'> {
  sending ??= (async () => {
    try {
      const items = await db.feedback.orderBy('createdAt').toArray()
      if (!items.length) return 'sent'
      if (!canSend() || navigator.onLine === false) return 'waiting'
      for (const f of items) {
        await upload(f)
        await db.feedback.delete(f.id)
      }
      return 'sent'
    } catch {
      return 'waiting'
    } finally {
      sending = null
    }
  })()
  return sending
}

async function upload(f: Feedback) {
  let id = kv.get(GIST) ?? (await findGist())
  if (id) {
    try { await gh(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: gistFiles(f) }) }); return }
    catch (e) { if ((e as { status?: number }).status !== 404) throw e; kv.remove(GIST) }
  }
  const g = await gh('/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: DESCRIPTION,
      public: false,
      files: { 'README.md': { content: 'Feedback from the Falo Português app. Read it with `node scripts/feedback.mjs list` in the app repo.\n' }, ...gistFiles(f) },
    }),
  })
  id = g.id as string
  kv.set(GIST, id)
}

async function findGist(): Promise<string | null> {
  for (let page = 1; page <= 5; page++) {
    const list: { id: string; description: string | null }[] = await gh(`/gists?per_page=100&page=${page}`)
    const hit = list.find(g => g.description === DESCRIPTION)
    if (hit) { kv.set(GIST, hit.id); return hit.id }
    if (list.length < 100) break
  }
  return null
}

/** Sends waiting feedback at start and whenever the phone comes back online. */
export function startFeedbackSync() {
  sendPending()
  addEventListener('online', () => { sendPending() })
}
