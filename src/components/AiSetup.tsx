import { useState } from 'react'
import { AiError, connectAi, disconnectAi, setLearnerName, useAi } from '../ai'
import { useToast } from '../toast'

const KEY_URL = 'https://aistudio.google.com/apikey'

/** Connect a free Gemini API key. Shown where AI features are used until a key is set. */
export function AiSetup({ onDone }: { onDone?: () => void }) {
  const toast = useToast()
  const { name } = useAi()
  const [key, setKey] = useState('')
  const [me, setMe] = useState(name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = async () => {
    setBusy(true); setError(null)
    try {
      await connectAi(key)
      setLearnerName(me)
      toast('Connected ✓ The conversation partner is ready.')
      onDone?.()
    } catch (e) {
      setError(e instanceof AiError ? e.message : `Couldn't connect: ${(e as Error).message}`)
    } finally { setBusy(false) }
  }

  return (
    <section className="card ai-setup">
      <h2>Connect Gemini (free)</h2>
      <p className="muted">The conversation partner and reading on any topic use Google's Gemini AI. It's free with your own API key:</p>
      <ol className="steps-list">
        <li>Open <a href={KEY_URL} target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> and sign in with Google.</li>
        <li>Tap <b>Create API key</b> and copy it.</li>
        <li>Paste it here.</li>
      </ol>
      <input className="input w-full" placeholder="Paste your API key" value={key} onChange={e => setKey(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <input className="input w-full" placeholder="Your first name (optional)" value={me} onChange={e => setMe(e.target.value)} />
      {error && <p className="text-error small" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block btn-big" onClick={connect} disabled={busy}>{busy ? 'Checking the key…' : 'Connect'}</button>
      <p className="small muted">The key stays on this phone. What you say or ask for is sent to Google, and on the free tier Google may use it to improve its models, so don't share anything private.</p>
    </section>
  )
}

/** Your first name: used in the Home greeting and by conversation characters. */
export function NameSetting() {
  const toast = useToast()
  const { name } = useAi()
  const [me, setMe] = useState(name)
  return (
    <section className="card">
      <label className="small muted" htmlFor="my-name">Your first name, for the greeting and conversation characters</label>
      <div className="row-btns" style={{ marginTop: 6 }}>
        <input id="my-name" className="input" value={me} onChange={e => setMe(e.target.value)} autoComplete="given-name" />
        <button className="btn btn-tonal" style={{ flex: 'none' }} onClick={() => { setLearnerName(me); toast(me.trim() ? 'Name saved.' : 'Name removed.') }}>Save</button>
      </div>
    </section>
  )
}

/** Settings row: connected status, disconnect. */
export function AiSettings() {
  const toast = useToast()
  const { connected, model } = useAi()
  if (!connected) return <AiSetup />
  return (
    <section className="card">
      <h2>Conversation partner</h2>
      <p className="muted">Connected to Gemini{model ? ` (${model.replace('models/', '')})` : ''}. Used for conversations and reading on any topic.</p>
      <button className="btn btn-ghost btn-block mt-3" onClick={() => {
        if (!confirm('Remove the Gemini key from this phone? Conversations and AI texts stay.')) return
        disconnectAi(); toast('Gemini disconnected.')
      }}>Disconnect Gemini</button>
    </section>
  )
}
