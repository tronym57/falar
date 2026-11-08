import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import { db } from './db'
import { kv } from './kv'
import { backupNow, connect, getStatus, parseBackup, restore, snapshot, summarize } from './backup'

// ---------- a fake GitHub Gist API ----------
type FakeGist = { id: string; description: string; files: Record<string, { content: string }> }
let gists: FakeGist[]
let calls: string[]

function fakeFetch(validToken = 'good-token') {
  return vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const path = url.replace('https://api.github.com', '')
    calls.push(`${method} ${path.split('?')[0]}`)
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
    if ((init.headers as Record<string, string>).Authorization !== `Bearer ${validToken}`) return json(401, { message: 'Bad credentials' })
    if (method === 'GET' && path.startsWith('/gists?')) return json(200, gists)
    const m = path.match(/^\/gists\/(\w+)$/)
    if (m) {
      const g = gists.find(x => x.id === m[1])
      if (!g) return json(404, {})
      if (method === 'PATCH') Object.assign(g.files, JSON.parse(init.body as string).files)
      return json(200, g)
    }
    if (method === 'POST' && path === '/gists') {
      const g = { id: `g${gists.length + 1}`, ...JSON.parse(init.body as string) }
      gists.push(g)
      return json(201, g)
    }
    return json(500, {})
  })
}

async function seed() {
  await db.progress.put({ key: '0:check', unit: 0, step: 'check', done: true, bestScore: 1, updatedAt: '2026-11-08T10:00:00Z' })
  await db.progress.put({ key: '0:vocab', unit: 0, step: 'vocab', done: true, updatedAt: '2026-11-08T10:00:00Z' })
  await db.cards.put({ id: 'u0-v01', unit: 0, fsrs: createEmptyCard(new Date('2026-11-09T09:00:00Z')), addedAt: '2026-11-08T10:00:00Z' })
  await db.customWords.put({ id: 'my-1', pt: 'a onda', en: 'the wave', addedAt: '2026-11-08T10:00:00Z' })
}

beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()))
  for (const k of ['falar.gist.token', 'falar.gist.id', 'falar.backup.last', 'falar.backup.error', 'falar.backup.dirty', 'falar.backup.conflict', 'falar.deviceId']) kv.remove(k)
  gists = []
  calls = []
  vi.stubGlobal('fetch', fakeFetch())
})
afterEach(() => vi.unstubAllGlobals())

describe('file format', () => {
  it('round-trips everything, including review card dates', async () => {
    await seed()
    const text = JSON.stringify(await snapshot())
    await Promise.all(db.tables.map(t => t.clear()))
    await restore(parseBackup(text))
    expect(await db.progress.count()).toBe(2)
    const card = await db.cards.get('u0-v01')
    expect(card!.fsrs.due).toBeInstanceOf(Date)
    expect(card!.fsrs.due.toISOString()).toBe('2026-11-09T09:00:00.000Z')
    expect((await db.customWords.get('my-1'))!.pt).toBe('a onda')
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/)
    expect(() => parseBackup('{"app":"other"}')).toThrow(/isn't a Falo Portuguese backup/)
    expect(() => parseBackup('{"app":"falar","schema":99,"tables":{}}')).toThrow(/newer version/)
  })

  it('summarizes a backup', async () => {
    await seed()
    expect(summarize(await snapshot())).toMatchObject({ unitsDone: 1, steps: 2, words: 1, myWords: 1 })
  })
})

describe('GitHub backup', () => {
  it('reports a wrong token clearly', async () => {
    await expect(connect('bad-token')).rejects.toThrow(/rejected the token/)
    expect(getStatus().connected).toBe(false)
  })

  it('creates the Gist on the first backup, then updates it', async () => {
    await seed()
    expect(await connect('good-token')).toEqual({ existing: null })
    expect(await backupNow()).toBe('done')
    expect(gists).toHaveLength(1)
    expect(calls).toContain('POST /gists')
    await db.customWords.put({ id: 'my-2', pt: 'o mar', en: 'the sea', addedAt: '2026-11-08T11:00:00Z' })
    expect(await backupNow()).toBe('done')
    expect(calls).toContain('PATCH /gists/g1')
    const saved = parseBackup(gists[0].files['falar-backup.json'].content)
    expect(saved.tables.customWords).toHaveLength(2)
    expect(getStatus()).toMatchObject({ connected: true, error: null })
    expect(getStatus().last).not.toBeNull()
  })

  it('never overwrites a backup from another install without asking', async () => {
    // Old install backs up its progress…
    await seed()
    await connect('good-token')
    await backupNow()
    const original = gists[0].files['falar-backup.json'].content
    // …icon deleted, reinstalled, "Start fresh": new device id, empty data.
    await Promise.all(db.tables.map(t => t.clear()))
    kv.remove('falar.deviceId')
    kv.remove('falar.gist.id')
    const { existing } = await connect('good-token')
    expect(existing).toMatchObject({ unitsDone: 1, words: 1, sameDevice: false })
    expect(await backupNow()).toBe('conflict')
    expect(gists[0].files['falar-backup.json'].content).toBe(original) // untouched
    expect(getStatus().conflict).toMatchObject({ unitsDone: 1 })
    // Explicit overwrite works.
    expect(await backupNow({ force: true })).toBe('done')
    expect(parseBackup(gists[0].files['falar-backup.json'].content).tables.progress).toHaveLength(0)
  })

  it('after restoring, keeps backing up to the same Gist without a conflict', async () => {
    await seed()
    await connect('good-token')
    await backupNow()
    await Promise.all(db.tables.map(t => t.clear()))
    kv.remove('falar.deviceId')
    await connect('good-token')
    await restore(parseBackup(gists[0].files['falar-backup.json'].content))
    expect(await db.progress.count()).toBe(2)
    expect(await backupNow()).toBe('done')
    expect(gists).toHaveLength(1)
  })

  it('starts a new Gist if the old one was deleted on GitHub', async () => {
    await seed()
    await connect('good-token')
    await backupNow()
    gists = []
    expect(await backupNow()).toBe('done')
    expect(gists).toHaveLength(1)
  })
})
