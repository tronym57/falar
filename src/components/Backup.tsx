import { useRef, useState } from 'react'
import {
  backupNow, connect, disconnect, exportFile, fetchRemote, hasLocalData, readFile, restore, summarize,
  useBackupStatus, type BackupFile, type BackupSummary,
} from '../backup'
import { intervalLabel } from '../review'
import { useToast } from '../toast'

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Falo%20Portuguese%20backup'

const ago = (iso: string) => {
  const ms = Date.now() - +new Date(iso)
  return ms < 60_000 ? 'just now' : `${intervalLabel(new Date(Date.now() + ms), new Date())} ago`
}
const date = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function SummaryLine({ s }: { s: BackupSummary }) {
  return (
    <p className="muted">
      Saved {date(s.exportedAt)} · {s.steps} steps done{s.unitsDone ? ` (${s.unitsDone} unit${s.unitsDone > 1 ? 's' : ''} complete)` : ''} · {s.words} words in review{s.myWords ? ` · ${s.myWords} own words` : ''}
    </p>
  )
}

/** How to create the token: shown during setup and restore. */
function TokenSteps() {
  return (
    <ol className="howto">
      <li><a href={TOKEN_URL} target="_blank" rel="noreferrer">Open GitHub's token page</a> and sign in.</li>
      <li>Expiration: pick <b>No expiration</b>. Only <b>gist</b> is ticked; leave it that way.</li>
      <li>Tap <b>Generate token</b>, copy it, and save it in your password manager.</li>
      <li>Come back here and paste it below.</li>
    </ol>
  )
}

/** Paste a token → connect. Calls back with the existing backup (if any). */
function TokenForm({ onConnected, label = 'Connect' }: { onConnected: (existing: BackupSummary | null) => void; label?: string }) {
  const toast = useToast()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!token.trim()) return toast('Paste your GitHub token first.')
    setBusy(true)
    try { onConnected((await connect(token)).existing) }
    catch (e) { toast((e as Error).message, 'error') }
    finally { setBusy(false) }
  }
  return (
    <div className="add-form">
      <input className="input w-full" type="password" placeholder="Paste token (ghp_…)" value={token} onChange={e => setToken(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button className="btn btn-primary btn-block btn-big" onClick={submit}>{busy ? 'Checking…' : label}</button>
    </div>
  )
}

/** Confirm and restore a backup from GitHub. */
function RestorePrompt({ summary, onDone, onSkip, skipLabel }: { summary: BackupSummary; onDone: () => void; onSkip?: () => void; skipLabel?: string }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (await hasLocalData() && !confirm('This replaces the progress on this phone with the backup. Continue?')) return
    setBusy(true)
    try {
      const remote = await fetchRemote()
      if (!remote) throw new Error('No backup found on GitHub.')
      await restore(remote)
      toast('Progress restored ✓')
      onDone()
    } catch (e) { toast(`Restore failed: ${(e as Error).message}`, 'error') }
    finally { setBusy(false) }
  }
  return (
    <div className="card ep-note">
      <h2>Backup found on GitHub</h2>
      <SummaryLine s={summary} />
      <button className="btn btn-primary btn-block btn-big" onClick={run}>{busy ? 'Restoring…' : 'Restore this backup'}</button>
      {onSkip && <button className="btn btn-tonal btn-block btn-big" onClick={onSkip}>{skipLabel ?? 'Not now'}</button>}
    </div>
  )
}

// ---------- Settings → Backup ----------
export function BackupSettings() {
  const toast = useToast()
  const st = useBackupStatus()
  const [setup, setSetup] = useState(false)
  const [found, setFound] = useState<BackupSummary | null>(null)

  const run = async (force = false) => {
    try {
      const r = await backupNow({ force })
      if (r === 'done') toast('Backed up to GitHub ✓')
      else if (r === 'conflict') toast('The GitHub backup is from another install. Choose below what to keep.', 'error')
      else if (!navigator.onLine) toast("You're offline. The backup runs when you're back online.")
    } catch (e) { toast((e as Error).message, 'error') }
  }

  return (
    <section className="card">
      <h2>Backup</h2>
      {!st.connected ? (
        <>
          <p className="muted">Your progress lives on this phone. Deleting the app icon deletes it. Connect GitHub and it's backed up automatically to a private Gist.</p>
          {!setup ? (
            <button className="btn btn-primary btn-block btn-big" onClick={() => setSetup(true)}>Set up GitHub backup</button>
          ) : (
            <>
              <TokenSteps />
              <TokenForm onConnected={async existing => {
                setSetup(false)
                if (existing && !existing.sameDevice) { setFound(existing); return }
                await run()
              }} />
            </>
          )}
        </>
      ) : (
        <>
          <div className="row">
            <span>GitHub backup</span>
            <span className={st.error ? 'text-error' : 'muted'}>
              {st.running ? 'Backing up…' : st.error ? 'Failed' : st.last ? `${ago(st.last)} ✓` : 'Not yet'}
            </span>
          </div>
          {st.error && <p className="text-error small">{st.error}</p>}
          <p className="muted small">Runs automatically after you practise and when you leave the app.</p>
          <button className="btn btn-primary btn-block btn-big" onClick={() => run()}>Back up now</button>
          <button className="btn btn-tonal btn-block btn-big" onClick={async () => {
            try { const r = await fetchRemote(); r ? setFound(summarize(r)) : toast('No backup on GitHub yet. Tap “Back up now”.') }
            catch (e) { toast((e as Error).message, 'error') }
          }}>Restore from GitHub…</button>
        </>
      )}

      {st.conflict && !found && (
        <div className="card border-error" style={{ marginTop: 12 }}>
          <h2>Two different progress states</h2>
          <p>The backup on GitHub came from another install (e.g. before you reinstalled the app):</p>
          <SummaryLine s={st.conflict} />
          <button className="btn btn-primary btn-block btn-big" onClick={() => setFound(st.conflict)}>Keep the GitHub backup (restore it)</button>
          <button className="btn btn-tonal btn-block btn-big" onClick={() => { if (confirm('Overwrite the GitHub backup with this phone’s progress? The old backup is lost.')) run(true) }}>Keep this phone's progress</button>
        </div>
      )}
      {found && <RestorePrompt summary={found} onDone={() => setFound(null)} onSkip={() => setFound(null)} skipLabel="Cancel" />}

      <FileBackup />

      {st.connected && (
        <div className="row disconnect-row">
          <span className="muted small">Stop backing up on this phone</span>
          <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm('Disconnect GitHub backup on this phone? The backup itself stays on GitHub.')) { disconnect(); toast('Disconnected. Your backup stays on GitHub.') } }}>Disconnect</button>
        </div>
      )}
    </section>
  )
}

function FileBackup() {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  return (
    <div style={{ marginTop: 16 }}>
      <p className="muted small">Or keep a file copy (Files / iCloud Drive):</p>
      <div className="row-btns">
        <button className="btn btn-tonal btn-block btn-big" style={{ marginTop: 0 }} onClick={async () => {
          try { const r = await exportFile(); if (r !== 'cancelled') toast('Backup file created ✓') }
          catch (e) { toast(`Export failed: ${(e as Error).message}`, 'error') }
        }}>Export file</button>
        <button className="btn btn-tonal btn-block btn-big" style={{ marginTop: 0 }} onClick={() => input.current?.click()}>Import file</button>
      </div>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={async e => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        try { setPending(await readFile(f)) } catch (err) { toast((err as Error).message, 'error') }
      }} />
      {pending && (
        <div className="card ep-note" style={{ marginTop: 12 }}>
          <h2>Import this backup?</h2>
          <SummaryLine s={summarize(pending)} />
          <p className="small">This replaces the progress on this phone.</p>
          <button className="btn btn-primary btn-block btn-big" onClick={async () => {
            try { await restore(pending); setPending(null); toast('Progress imported ✓') }
            catch (err) { toast(`Import failed: ${(err as Error).message}`, 'error') }
          }}>Import</button>
          <button className="btn btn-tonal btn-block btn-big" onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// ---------- first launch ----------
export function Welcome({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [mode, setMode] = useState<'choose' | 'github' | 'file'>('choose')
  const [found, setFound] = useState<BackupSummary | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)

  return (
    <main className="screen">
      <h1>Bem-vindo! 👋</h1>
      <p className="muted" style={{ marginBottom: 16 }}>New here, or coming back after reinstalling the app?</p>

      {mode === 'choose' && (
        <>
          <button className="btn btn-primary btn-block btn-big" onClick={onDone}>Start fresh<small>First time using Falo Portuguese</small></button>
          <button className="btn btn-tonal btn-block btn-big" onClick={() => setMode('github')}>Restore from GitHub</button>
          <button className="btn btn-tonal btn-block btn-big" onClick={() => input.current?.click()}>Import a backup file</button>
          <input ref={input} type="file" accept="application/json,.json" hidden onChange={async e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try { setPending(await readFile(f)); setMode('file') } catch (err) { toast((err as Error).message, 'error') }
          }} />
        </>
      )}

      {mode === 'github' && !found && (
        <section className="card">
          <h2>Restore from GitHub</h2>
          <p className="muted">Paste the token you saved in your password manager. Lost it? Create a new one:</p>
          <TokenSteps />
          <TokenForm label="Find my backup" onConnected={existing => {
            if (existing) setFound(existing)
            else toast('No backup found for this token. You can start fresh; backups will go to this account.', 'error')
          }} />
          <button className="btn btn-tonal btn-block btn-big" onClick={() => setMode('choose')}>Back</button>
        </section>
      )}
      {found && <RestorePrompt summary={found} onDone={onDone} onSkip={() => { setFound(null); setMode('choose') }} skipLabel="Back" />}

      {mode === 'file' && pending && (
        <div className="card ep-note">
          <h2>Import this backup?</h2>
          <SummaryLine s={summarize(pending)} />
          <button className="btn btn-primary btn-block btn-big" onClick={async () => {
            try { await restore(pending); toast('Progress imported ✓'); onDone() }
            catch (err) { toast(`Import failed: ${(err as Error).message}`, 'error') }
          }}>Import</button>
          <button className="btn btn-tonal btn-block btn-big" onClick={() => { setPending(null); setMode('choose') }}>Back</button>
        </div>
      )}
    </main>
  )
}
