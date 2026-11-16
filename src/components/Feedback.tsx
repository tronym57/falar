import { useState } from 'react'
import { canSend, capture, NO_CAPTURE, screenContext, submitFeedback } from '../feedback'
import { useToast } from '../toast'

type Draft = { image: string; context: Record<string, unknown> }

/** A small tab on the right edge of every screen: tap it to send feedback with a screenshot of this screen. */
export function FeedbackButton() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  const open = async () => {
    if (busy) return
    setBusy(true)
    try {
      // The screenshot comes first, so the sheet isn't in it.
      const context = screenContext()
      setDraft({ image: await capture(), context })
    } catch (e) {
      toast(`Couldn't take the screenshot: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button className={`fb-tab ${NO_CAPTURE}`} onClick={open} aria-label="Give feedback on this screen">
      {busy ? <span className="loading loading-spinner loading-xs" /> : '✎'}
    </button>
    {draft && <Sheet draft={draft} onClose={() => setDraft(null)} />}
  </>
}

function Sheet({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [big, setBig] = useState(false)

  const send = async () => {
    if (!note.trim()) return toast('Write what should change first.')
    setSending(true)
    try {
      const r = await submitFeedback(note.trim(), draft.image, draft.context)
      toast(r === 'sent' ? 'Feedback sent ✓ Claude Code will see it next time.'
        : canSend() ? 'Saved on this phone. It’s sent when you’re back online.'
          : 'Saved on this phone. Turn on GitHub backup in Settings to send it.')
      onClose()
    } catch (e) {
      toast(`Couldn't save it: ${(e as Error).message}`, 'error')
      setSending(false)
    }
  }

  return (
    <div className={`fb-overlay ${NO_CAPTURE}`} onClick={e => { if (e.target === e.currentTarget && !sending) onClose() }}>
      <form className="fb-sheet" role="dialog" aria-label="Feedback on this screen" onSubmit={e => { e.preventDefault(); send() }}>
        <h2>Feedback on this screen</h2>
        <button type="button" className={'fb-shot' + (big ? ' big' : '')} onClick={() => setBig(!big)} aria-label={big ? 'Show the screenshot smaller' : 'Show the whole screenshot'}>
          <img src={draft.image} alt="Screenshot of this screen" />
        </button>
        <p className="small muted">{big ? 'Tap to make it smaller.' : 'Tap the screenshot to see all of it.'}</p>
        <textarea className="textarea w-full" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="What should change?" />
        <div className="fb-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" disabled={sending}>{sending ? <><span className="loading loading-spinner loading-sm" /> Sending…</> : 'Send'}</button>
        </div>
        <p className="small muted">Goes to your private feedback Gist on GitHub, with the screenshot and what's on this screen.</p>
      </form>
    </div>
  )
}
