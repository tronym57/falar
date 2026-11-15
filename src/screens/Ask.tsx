import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { audio, useAudio } from '../audio'
import { AiError, streamText, useAi } from '../ai'
import { AiSetup } from '../components/AiSetup'
import { ASK_SYSTEM, contextTurns, loadAsked, parseAnswer, saveAsked, threadTurns, type Asked } from '../ask'
import { addCustomWord } from '../review'
import { bpProblems } from '../bp'
import { db } from '../db'
import { useToast } from '../toast'

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, '').trim()

/** Live answer being written: to a new question (`to` null) or as a refinement of one (`to` its id). */
type Live = { to: string | null; q: string; a: string }

/** Quick refinements, one tap each. */
const REFINE = ['More polite', 'More casual', 'Simpler', 'Another way to say it']

/** Ask what to say: answers stream in live; each phrase can be played and saved to My words; any answer can be refined. */
export default function Ask() {
  const toast = useToast()
  const navigate = useNavigate()
  const { connected } = useAi()
  const [list, setList] = useState<Asked[]>(loadAsked)
  const [q, setQ] = useState('')
  const [live, setLive] = useState<Live | null>(null)
  const [error, setError] = useState<{ to: string | null; text: string } | null>(null)
  const stop = useRef<AbortController | null>(null)
  useEffect(() => () => { stop.current?.abort(); audio.stop() }, [])

  /** Ask something new (`to` null) or refine an answer (`to` its id). Resolves true when it worked. */
  const send = async (question: string, to: string | null) => {
    if (live) { toast('Wait for this answer to finish first.'); return false }
    const target = to ? list.find(x => x.id === to) : undefined
    setError(null)
    setLive({ to, q: question, a: '' })
    const ctl = new AbortController()
    stop.current = ctl
    try {
      const turns = target ? threadTurns(target, question) : contextTurns(list, question)
      const a = await streamText({ system: ASK_SYSTEM, turns, signal: ctl.signal, onText: text => setLive({ to, q: question, a: text }) })
      const next = target
        ? list.map(x => x.id === to ? { ...x, more: [...(x.more ?? []), { q: question, a }] } : x)
        : [{ id: Date.now().toString(36), q: question, a, at: new Date().toISOString() }, ...list]
      setList(next)
      saveAsked(next)
      return true
    } catch (e) {
      if (!ctl.signal.aborted) setError({ to, text: e instanceof AiError ? e.message : `Something went wrong: ${(e as Error).message}` })
      return false
    } finally {
      setLive(null)
    }
  }

  const ask = async () => {
    const question = q.trim()
    if (!question) return toast('Type a situation, a question or a word first.')
    if (await send(question, null)) setQ('')
  }

  const clear = () => {
    if (!confirm('Clear your questions here? Phrases you saved stay in My words.')) return
    setList([]); saveAsked([])
  }

  const errorCard = (to: string | null) => error?.to === to && <div className="card border-error" role="alert"><p>{error.text}</p></div>

  return (
    <main className="screen">
      {/* Back to where you opened it from; Home if the app was opened straight here. */}
      <div className="title-row">
        <button className="btn btn-ghost btn-circle btn-sm text-2xl text-primary -ml-2" aria-label="Back" onClick={() => (window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/')}>‹</button>
        <h1>Desenrasca</h1>
      </div>
      {!connected ? <AiSetup /> : (
        <form className="card ask-form" onSubmit={e => { e.preventDefault(); ask() }}>
          <textarea className="textarea w-full ask-input" rows={2} value={q} onChange={e => setQ(e.target.value)} placeholder="A situation, question or word"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }} />
          <button className="btn btn-primary btn-block btn-big" disabled={!!live}>
            {live?.to === null ? <><span className="loading loading-spinner loading-sm" /> Answering…</> : 'Help me say it'}
          </button>
          <p className="small muted">Your question goes to Google Gemini.</p>
        </form>
      )}
      {errorCard(null)}
      {live?.to === null && <section className="card ask-answer"><Turn q={live.q} a={live.a} clip="ask-live" streaming /></section>}
      {list.map(x => (
        <section key={x.id} className="card ask-answer">
          <Turn q={x.q} a={x.a} clip={`ask-${x.id}`} />
          {(x.more ?? []).map((m, i) => <Turn key={i} q={m.q} a={m.a} clip={`ask-${x.id}-${i}`} refinement />)}
          {live?.to === x.id && <Turn q={live.q} a={live.a} clip={`ask-${x.id}-live`} refinement streaming />}
          {errorCard(x.id)}
          {connected && <Refine busy={!!live} onSend={text => send(text, x.id)} />}
        </section>
      ))}
      {list.length > 0 && <button className="btn btn-ghost btn-block mt-2" onClick={clear}>Clear these questions</button>}
      <p className="small muted ask-meaning">
        <b lang="pt-PT">Desenrasca</b> (from <i lang="pt-PT">desenrascar</i>): to get yourself out of a tricky spot with whatever you have. Very Portuguese: <i lang="pt-PT">“Eu desenrasco-me.”</i> = I'll manage.
      </p>
    </main>
  )
}

/** One question (or refinement) and its answer. */
function Turn({ q, a, clip: base, streaming, refinement }: { q: string; a: string; clip: string; streaming?: boolean; refinement?: boolean }) {
  const toast = useToast()
  const { playing } = useAudio()
  const mine = useLiveQuery(() => db.customWords.toArray())
  const saved = new Set((mine ?? []).map(w => fold(w.pt)))
  const blocks = parseAnswer(a)
  const save = async (pt: string, en: string) => {
    try { await addCustomWord(pt, en); toast('Saved to My words ✓ It joins your daily review and Vocabulary training.') }
    catch (e) { toast(`Couldn't save it: ${(e as Error).message}`, 'error') }
  }
  return (
    <div className={refinement ? 'ask-turn ask-refined' : 'ask-turn'}>
      <p className="ask-q">{refinement && <span className="muted">↳ </span>}{q}</p>
      {!blocks.length && streaming && (
        <p className="ask-wait" role="status"><span className="loading loading-dots loading-md text-primary" /> Finding what to say…</p>
      )}
      {blocks.map((b, i) => {
        if (b.kind === 'note') return <p key={i} className="small ask-note">💡 {b.text}</p>
        if (b.kind === 'text') return <p key={i}>{b.text}</p>
        const clip = `${base}-${i}`
        const done = !streaming || i < blocks.length - 1
        const br = done ? bpProblems(b.pt) : []
        return (
          <div key={i} className="ask-say">
            <p className="ask-pt" lang="pt-PT">{b.pt}</p>
            {b.en && <p className="muted">{b.en}</p>}
            {br.length > 0 && <p className="small text-warning">⚠ This may be Brazilian: {br.join('; ')}</p>}
            {done && (
              <div className="ask-actions">
                <button className={'btn btn-tonal btn-sm' + (playing === clip ? ' playing' : '')} onClick={() => audio.speak(clip, b.pt)}>{playing === clip ? '🔊 Playing' : '▶ Listen'}</button>
                {saved.has(fold(b.pt))
                  ? <button className="btn btn-ghost btn-sm" onClick={() => toast('Already in My words. Find it in the Vocab tab.')}>Saved ✓</button>
                  : <button className="btn btn-tonal btn-sm" onClick={() => b.en ? save(b.pt, b.en) : toast('This one has no English meaning to save it with.')}>＋ Save to practise</button>}
              </div>
            )}
          </div>
        )
      })}
      {streaming && blocks.length > 0 && <span className="loading loading-dots loading-sm text-primary" aria-label="Still writing" />}
    </div>
  )
}

/** Refine an answer: one tap for the usual changes, or type more context. */
function Refine({ busy, onSend }: { busy: boolean; onSend: (text: string) => Promise<boolean> }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const go = async (t: string) => {
    if (!t.trim()) return toast('Type what to add or change, or tap one of the suggestions.')
    if (await onSend(t.trim())) { setText(''); setOpen(false) }
  }
  if (!open) return <button className="btn btn-ghost btn-sm ask-refine-open" onClick={() => setOpen(true)}>✎ Refine this answer</button>
  return (
    <form className="ask-refine" onSubmit={e => { e.preventDefault(); go(text) }}>
      <div className="ask-chips">
        {REFINE.map(r => <button key={r} type="button" className="btn btn-tonal btn-xs rounded-full" disabled={busy} onClick={() => go(r)}>{r}</button>)}
      </div>
      <textarea className="textarea w-full ask-input" rows={2} value={text} onChange={e => setText(e.target.value)} autoFocus
        placeholder="Add context or ask for a change" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(text) } }} />
      <div className="ask-refine-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? <><span className="loading loading-spinner loading-xs" /> Answering…</> : 'Refine'}</button>
      </div>
    </form>
  )
}
