import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { audio, useAudio } from '../audio'
import { AiError, streamText, useAi } from '../ai'
import { AiSetup } from '../components/AiSetup'
import { ASK_SYSTEM, contextTurns, loadAsked, parseAnswer, saveAsked, type Asked } from '../ask'
import { addCustomWord } from '../review'
import { bpProblems } from '../bp'
import { db } from '../db'
import { useToast } from '../toast'

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, '').trim()

/** Ask what to say: answers stream in live; each phrase can be played and saved to My words. */
export default function Ask() {
  const toast = useToast()
  const { connected } = useAi()
  const [list, setList] = useState<Asked[]>(loadAsked)
  const [q, setQ] = useState('')
  const [live, setLive] = useState<{ q: string; a: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stop = useRef<AbortController | null>(null)
  useEffect(() => () => { stop.current?.abort(); audio.stop() }, [])

  const ask = async () => {
    const question = q.trim()
    if (!question) return toast('Type a situation, a question or a word first.')
    if (live) return
    setError(null)
    setLive({ q: question, a: '' })
    const ctl = new AbortController()
    stop.current = ctl
    try {
      const a = await streamText({ system: ASK_SYSTEM, turns: contextTurns(list, question), signal: ctl.signal, onText: text => setLive({ q: question, a: text }) })
      const next = [{ id: Date.now().toString(36), q: question, a, at: new Date().toISOString() }, ...list]
      setList(next)
      saveAsked(next)
      setQ('')
    } catch (e) {
      if (ctl.signal.aborted) return
      setError(e instanceof AiError ? e.message : `Something went wrong: ${(e as Error).message}`)
    } finally {
      setLive(null)
    }
  }

  const clear = () => {
    if (!confirm('Clear your questions here? Phrases you saved stay in My words.')) return
    setList([]); saveAsked([])
  }

  return (
    <main className="screen">
      <h1>Ask</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Not sure what to say? Describe the situation, ask a question, or type a word, in English or Portuguese.</p>
      {!connected ? <AiSetup /> : (
        <form className="card ask-form" onSubmit={e => { e.preventDefault(); ask() }}>
          <textarea className="textarea w-full ask-input" rows={2} value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. At the pharmacy, I need something for a cough"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }} />
          <button className="btn btn-primary btn-block btn-big" disabled={!!live}>{live ? 'Answering…' : 'Ask'}</button>
          <p className="small muted">Your question goes to Google Gemini.</p>
        </form>
      )}
      {error && <div className="card border-error" role="alert"><p>{error}</p></div>}
      {live && <AnswerCard q={live.q} a={live.a} id="live" streaming />}
      {list.map(x => <AnswerCard key={x.id} q={x.q} a={x.a} id={x.id} />)}
      {list.length > 0 && <button className="btn btn-ghost btn-block mt-2" onClick={clear}>Clear these questions</button>}
    </main>
  )
}

function AnswerCard({ q, a, id, streaming }: { q: string; a: string; id: string; streaming?: boolean }) {
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
    <section className="card ask-answer">
      <p className="ask-q">{q}</p>
      {!blocks.length && streaming && <p className="muted">Thinking…</p>}
      {blocks.map((b, i) => {
        if (b.kind === 'note') return <p key={i} className="small ask-note">💡 {b.text}</p>
        if (b.kind === 'text') return <p key={i}>{b.text}</p>
        const clip = `ask-${id}-${i}`
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
    </section>
  )
}
