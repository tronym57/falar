// Backup: export/import a JSON file, and automatic sync to a private GitHub Gist.
// See v1-plan.md §2 for the behaviour this implements.
import { useSyncExternalStore } from 'react'
import { db } from './db'
import { kv } from './kv'

export const SCHEMA = 1
const FILE = 'falar-backup.json'
const DESCRIPTION = 'falar-backup'
const API = 'https://api.github.com'
const TABLES = ['progress', 'sessions', 'attempts', 'cards', 'reviewLogs', 'customWords'] as const
type TableName = (typeof TABLES)[number]

export type BackupFile = {
  app: 'falar'
  schema: number
  exportedAt: string
  deviceId: string
  tables: Record<TableName, unknown[]>
  settings: Record<string, string>
}

const K = {
  token: 'falar.gist.token',
  gistId: 'falar.gist.id',
  last: 'falar.backup.last',
  error: 'falar.backup.error',
  dirty: 'falar.backup.dirty',
  conflict: 'falar.backup.conflict',
  device: 'falar.deviceId',
}
const SETTINGS_KEYS = ['slowAudio']

// ---------- status store (React subscribes to this) ----------
export type BackupStatus = {
  connected: boolean
  running: boolean
  last: string | null
  error: string | null
  conflict: BackupSummary | null
}
const listeners = new Set<() => void>()
let running = false
let cached: BackupStatus | null = null
const emit = () => { cached = null; listeners.forEach(l => l()) }

export function getStatus(): BackupStatus {
  if (!cached) {
    const c = kv.get(K.conflict)
    cached = { connected: !!kv.get(K.token), running, last: kv.get(K.last), error: kv.get(K.error), conflict: c ? JSON.parse(c) : null }
  }
  return cached
}
export function useBackupStatus() {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l) } }, getStatus)
}

export function deviceId() {
  let id = kv.get(K.device)
  if (!id) { id = crypto.randomUUID(); kv.set(K.device, id) }
  return id
}

// ---------- file format ----------
export async function snapshot(): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>
  for (const t of TABLES) tables[t] = await db.table(t).toArray()
  const settings: Record<string, string> = {}
  for (const k of SETTINGS_KEYS) { const v = kv.get(k); if (v !== null) settings[k] = v }
  return { app: 'falar', schema: SCHEMA, exportedAt: new Date().toISOString(), deviceId: deviceId(), tables, settings }
}

/** Parse and validate a backup. Throws a readable error if it isn't one. */
export function parseBackup(text: string): BackupFile {
  let data: BackupFile
  try { data = JSON.parse(text) } catch { throw new Error("This file isn't a Falo Portuguese backup (not valid JSON).") }
  if (data?.app !== 'falar' || !data.tables) throw new Error("This file isn't a Falo Portuguese backup.")
  if (data.schema > SCHEMA) throw new Error('This backup is from a newer version of the app. Update the app first.')
  for (const t of TABLES) if (!Array.isArray(data.tables[t] ?? [])) throw new Error(`Backup is damaged (${t}).`)
  // JSON turns Dates into strings; review cards need real Dates back.
  for (const c of (data.tables.cards ?? []) as { fsrs: { due: string | Date; last_review?: string | Date } }[]) {
    c.fsrs.due = new Date(c.fsrs.due)
    if (c.fsrs.last_review) c.fsrs.last_review = new Date(c.fsrs.last_review)
  }
  return data
}

export type BackupSummary = { exportedAt: string; unitsDone: number; steps: number; words: number; myWords: number; reviews: number; sameDevice?: boolean }

export function summarize(b: BackupFile): BackupSummary {
  const progress = (b.tables.progress ?? []) as { step: string; done: boolean }[]
  return {
    exportedAt: b.exportedAt,
    unitsDone: progress.filter(p => p.step === 'check' && p.done).length,
    steps: progress.filter(p => p.done).length,
    words: (b.tables.cards ?? []).length,
    myWords: (b.tables.customWords ?? []).length,
    reviews: (b.tables.reviewLogs ?? []).length,
  }
}

/** Replace everything on this phone with the backup. */
export async function restore(b: BackupFile) {
  await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      const rows = b.tables[t] ?? []
      if (rows.length) await db.table(t).bulkPut(rows)
    }
  })
  for (const [k, v] of Object.entries(b.settings ?? {})) if (SETTINGS_KEYS.includes(k)) kv.set(k, v)
  // Continue the backup chain of the restored install, so the next backup doesn't count as a conflict.
  kv.set(K.device, b.deviceId)
  kv.remove(K.conflict)
  kv.remove(K.dirty)
  emit()
}

export async function hasLocalData() {
  const counts = await Promise.all(['progress', 'cards', 'customWords'].map(t => db.table(t).count()))
  return counts.some(n => n > 0)
}

// ---------- GitHub Gist ----------
export class BackupError extends Error {
  status?: number
  constructor(message: string, status?: number) { super(message); this.status = status }
}

async function gh(path: string, init: RequestInit = {}, token = kv.get(K.token)) {
  if (!token) throw new BackupError('GitHub backup is not set up.')
  let r: Response
  try {
    r = await fetch(API + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch {
    throw new BackupError("Couldn't reach GitHub. Check your connection; the backup will retry.")
  }
  if (r.status === 401) throw new BackupError('GitHub rejected the token (wrong or expired). Set up the backup again with a new token.')
  if (r.status === 403) throw new BackupError("The token can't access Gists. Create it with the “gist” permission.", 403)
  if (r.status === 404) throw new BackupError('Backup Gist not found.', 404)
  if (!r.ok) throw new BackupError(`GitHub error ${r.status}. The backup will retry later.`)
  return r.json()
}

type Gist = { id: string; description: string | null; files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }> }

async function findGist(token?: string): Promise<string | null> {
  for (let page = 1; page <= 5; page++) {
    const list: Gist[] = await gh(`/gists?per_page=100&page=${page}`, {}, token)
    const hit = list.find(g => g.description === DESCRIPTION && g.files[FILE])
    if (hit) return hit.id
    if (list.length < 100) break
  }
  return null
}

async function readGist(id: string, token?: string): Promise<BackupFile> {
  const g: Gist = await gh(`/gists/${id}`, {}, token)
  const f = g.files[FILE]
  if (!f) throw new BackupError('The backup Gist is missing its file.')
  let text = f.content ?? ''
  if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url)).text()
  return parseBackup(text)
}

/** Check a token and look for an existing backup. Saves the token if it works. */
export async function connect(token: string): Promise<{ existing: BackupSummary | null }> {
  token = token.trim()
  if (!token) throw new BackupError('Paste your token first.')
  const id = await findGist(token)
  kv.set(K.token, token)
  kv.remove(K.error)
  if (id) kv.set(K.gistId, id)
  emit()
  if (!id) return { existing: null }
  const remote = await readGist(id, token)
  return { existing: { ...summarize(remote), sameDevice: remote.deviceId === deviceId() } }
}

export async function fetchRemote(): Promise<BackupFile | null> {
  const id = kv.get(K.gistId) ?? (await findGist())
  if (!id) return null
  kv.set(K.gistId, id)
  return readGist(id)
}

export function disconnect() {
  for (const k of [K.token, K.gistId, K.last, K.error, K.conflict]) kv.remove(k)
  emit()
}

/**
 * Back up to the Gist. Never overwrites a backup written by another install
 * (e.g. after reinstalling and tapping "Start fresh") unless `force` is set:
 * that case is stored as a conflict for you to decide in Settings.
 */
export async function backupNow({ force = false } = {}): Promise<'done' | 'skipped' | 'conflict'> {
  if (!kv.get(K.token) || running) return 'skipped'
  if (navigator.onLine === false) { kv.set(K.dirty, '1'); return 'skipped' }
  running = true
  emit()
  try {
    let id = kv.get(K.gistId) ?? (await findGist())
    if (id && !force) {
      const remote = await readGist(id).catch(e => {
        // Gist deleted on GitHub or its file removed: start a new backup.
        if (e instanceof BackupError && e.status === 404) { id = null; return null }
        if (e instanceof BackupError && /missing its file/.test(e.message)) return null
        throw e
      })
      if (remote && remote.deviceId !== deviceId()) {
        kv.set(K.conflict, JSON.stringify(summarize(remote)))
        return 'conflict'
      }
    }
    const content = JSON.stringify(await snapshot())
    const body = JSON.stringify({ description: DESCRIPTION, files: { [FILE]: { content } } })
    if (id) await gh(`/gists/${id}`, { method: 'PATCH', body })
    else {
      const g: Gist = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: DESCRIPTION, public: false, files: { [FILE]: { content } } }) })
      id = g.id
    }
    kv.set(K.gistId, id)
    kv.set(K.last, new Date().toISOString())
    for (const k of [K.error, K.dirty, K.conflict]) kv.remove(k)
    return 'done'
  } catch (e) {
    kv.set(K.error, (e as Error).message)
    kv.set(K.dirty, '1')
    throw e
  } finally {
    running = false
    emit()
  }
}

// ---------- automatic triggers ----------
let timer: ReturnType<typeof setTimeout> | undefined
const quiet = () => backupNow().catch(() => { /* error is stored and shown in Settings */ })

/** Mark that something changed; back up after 20 s of quiet (e.g. after finishing a step). */
export function markDirty() {
  kv.set(K.dirty, '1')
  clearTimeout(timer)
  timer = setTimeout(quiet, 20_000)
}

let started = false
/** Hook up auto-backup: on every data change, when the app goes to the background, and daily. */
export function startAutoBackup() {
  if (started) return
  started = true
  for (const t of TABLES) {
    const table = db.table(t)
    table.hook('creating', () => { markDirty() })
    table.hook('updating', () => { markDirty() })
    table.hook('deleting', () => { markDirty() })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && kv.get(K.dirty)) { clearTimeout(timer); quiet() }
  })
  addEventListener('online', () => { if (kv.get(K.dirty)) quiet() })
  const last = kv.get(K.last)
  if (kv.get(K.dirty) || !last || Date.now() - +new Date(last) > 24 * 3600_000) quiet()
}

// ---------- file export / import ----------
export async function exportFile() {
  const data = await snapshot()
  const name = `falar-backup-${data.exportedAt.slice(0, 10)}.json`
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' })
  // iPhone: the share sheet lets you save to Files / iCloud Drive.
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return 'shared' }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; /* fall through to download */ }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return 'downloaded'
}

export async function readFile(file: File) {
  return parseBackup(await file.text())
}
