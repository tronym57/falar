#!/usr/bin/env node
// Feedback sent from the app's ✎ button lives in a private Gist ("falar-feedback"). Uses the `gh` CLI's login.
//   node scripts/feedback.mjs list          download open items to .feedback/<id>/ (note.json, screenshot.jpg)
//   node scripts/feedback.mjs list --all    include items already done
//   node scripts/feedback.mjs done <id> "<what changed, commit>"   mark an item done
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = new URL('../.feedback/', import.meta.url).pathname
const api = (path, body) => JSON.parse(execFileSync('gh', ['api', ...(body ? ['-X', 'PATCH', '--input', '-'] : []), path],
  { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', maxBuffer: 1 << 28 }))

function findGist() {
  for (let page = 1; page <= 5; page++) {
    const list = api(`/gists?per_page=100&page=${page}`)
    const hit = list.find(g => g.description === 'falar-feedback')
    if (hit) return hit.id
    if (list.length < 100) break
  }
  return null
}

/** A file's text; big files come truncated in the API and are read from their raw URL. */
async function text(f) {
  if (!f.truncated) return f.content
  const r = await fetch(f.raw_url)
  if (!r.ok) throw new Error(`Couldn't download ${f.filename}: ${r.status}`)
  return r.text()
}

const [cmd = 'list', ...args] = process.argv.slice(2)
const id = findGist()
if (!id) { console.log('No feedback yet (no "falar-feedback" Gist).'); process.exit(0) }
const gist = api(`/gists/${id}`)

if (cmd === 'list') {
  const all = args.includes('--all')
  const items = []
  for (const f of Object.values(gist.files).filter(f => f.filename.endsWith('.json'))) {
    const item = JSON.parse(await text(f))
    if (item.status !== 'open' && !all) continue
    const dir = join(DIR, item.id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'note.json'), JSON.stringify(item, null, 2))
    const img = gist.files[`${item.id}.jpg.b64`]
    if (img) writeFileSync(join(dir, 'screenshot.jpg'), Buffer.from(await text(img), 'base64'))
    items.push({ ...item, dir, screenshot: img ? join(dir, 'screenshot.jpg') : null })
  }
  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  if (!items.length) console.log('No open feedback.')
  for (const x of items) {
    console.log(`\n## ${x.id}  [${x.status}]  ${x.createdAt}`)
    console.log(`Screen: ${x.context?.route}${x.context?.exercise ? `  · exercise ${x.context.exercise}` : ''}${x.context?.session ? `  · session ${x.context.session}` : ''}  · app ${x.context?.version}`)
    console.log(`Note: ${x.note}`)
    console.log(`Screenshot: ${x.screenshot ?? '(none)'}`)
    console.log(`Details: ${join(x.dir, 'note.json')}`)
  }
} else if (cmd === 'done') {
  const [itemId, ...what] = args
  const f = gist.files[`${itemId}.json`]
  if (!f) { console.error(`No feedback item ${itemId}.`); process.exit(1) }
  const item = { ...JSON.parse(await text(f)), status: 'done', doneAt: new Date().toISOString(), fix: what.join(' ') }
  // The picture is dropped from the Gist once it's handled (a copy stays in .feedback/).
  const files = { [`${itemId}.json`]: { content: JSON.stringify(item, null, 2) } }
  if (gist.files[`${itemId}.jpg.b64`]) files[`${itemId}.jpg.b64`] = null
  api(`/gists/${id}`, { files })
  console.log(`Marked ${itemId} done.`)
} else {
  console.error('Usage: node scripts/feedback.mjs list [--all] | done <id> "<what changed>"')
  process.exit(1)
}
