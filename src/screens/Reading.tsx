import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { audio, useAudio } from '../audio'
import { SlowToggle } from '../components/AudioRow'
import { meaning, readingById, readingQuestions, readingStep, readingTexts, tokens } from '../content/reading'
import Practice from './Practice'
import type { ReadingText } from '../content/types'
import { AiError, useAi } from '../ai'
import { AiSetup } from '../components/AiSetup'
import { createAiText, TOPIC_IDEAS } from '../aiReading'
import { useToast } from '../toast'

/** A bundled text, or one Gemini wrote for you. `undefined` while loading, `null` if there's none. */
function useText(id: string): ReadingText | null | undefined {
  const bundled = readingById(id)
  const ai = useLiveQuery(async () => (id.startsWith('ai-') ? (await db.aiTexts.get(id)) ?? null : null), [id])
  return bundled ?? ai
}

/** Best score per text id (texts are stored as steps of unit -1). */
function useReadingProgress() {
  return useLiveQuery(async () => {
    const rows = await db.progress.where('unit').equals(-1).toArray()
    return Object.fromEntries(rows.map(r => [r.step, r.bestScore ?? 0])) as Record<string, number>
  })
}

// ---------- /reading ----------
export default function ReadingList() {
  const best = useReadingProgress()
  const mine = useLiveQuery(() => db.aiTexts.orderBy('createdAt').reverse().toArray())
  const card = (t: ReadingText) => {
    const b = best?.[readingStep(t.id)]
    return (
      <Link key={t.id} className="card tap" to={`/reading/${t.id}`}>
        <span className="chev">›</span>
        <div className="read-card-head">
          <h2>{t.emoji} {t.title}</h2>
          {b !== undefined
            ? <span className="badge badge-sm badge-soft badge-success">✓ {Math.round(b * 100)}%</span>
            : <span className="badge badge-sm badge-soft badge-info">New</span>}
        </div>
        <p className="muted">{t.en}</p>
        <p className="small muted" style={{ marginTop: 6 }}><span className="level-tag">{t.level}</span>{t.after >= 0 ? ` · After Unit ${t.after}` : ' · Written for you'}</p>
      </Link>
    )
  }
  return (
    <main className="screen">
      <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice">‹ Practice</Link>
      <h1>Reading</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Short texts about life around Peniche, easiest first. Tap any word to see what it means. A1+ texts have a few harder phrases, explained under the text. “After Unit N” says when a text is easiest to read.</p>
      <AnyTopic />
      {!!mine?.length && <p className="section-label">Written for you</p>}
      {mine?.map(card)}
      <p className="section-label">Course texts</p>
      {readingTexts.map(card)}
    </main>
  )
}

/** "Read about anything": Gemini writes an A1 text on your topic. */
function AnyTopic() {
  const { connected } = useAi()
  const navigate = useNavigate()
  const toast = useToast()
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!connected) {
    return setup ? <AiSetup /> : (
      <button className="card tap ai-card" onClick={() => setSetup(true)}>
        <span className="chev">›</span>
        <h2>✨ Read about anything</h2>
        <p className="muted">Pick any topic and get a short A1 text with questions. Needs a free Gemini key: tap to set it up.</p>
      </button>
    )
  }
  const go = async (t: string) => {
    if (!t.trim()) return toast('Type a topic first, or tap one of the ideas.')
    if (busy) return
    setBusy(true); setError(null)
    try {
      const { text, problems } = await createAiText(t)
      if (problems.length) toast(`Heads-up: this text may contain a Brazilian form (${problems[0]}).`)
      navigate(`/reading/${text.id}`)
    } catch (e) {
      setError(e instanceof AiError ? e.message : (e as Error).message)
    } finally { setBusy(false) }
  }
  return (
    <section className="card ai-card">
      <h2>✨ Read about anything</h2>
      <p className="muted">Type a topic. You get a short A1 text in European Portuguese with every word explained and 5 questions.</p>
      <div className="talk-input" style={{ marginTop: 12 }}>
        <input className="input flex-1" placeholder="e.g. surfing in winter" value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && go(topic)} />
        <button className="btn btn-primary" onClick={() => go(topic)}>{busy ? 'Writing…' : 'Write'}</button>
      </div>
      <div className="filters wrap" style={{ marginTop: 10 }}>
        {TOPIC_IDEAS.map(i => <button key={i} className="btn btn-sm rounded-full btn-soft" onClick={() => { setTopic(i); go(i) }}>{i}</button>)}
      </div>
      {busy && <p className="small muted" role="status">Writing your text… this takes about 10–20 seconds.</p>}
      {error && <p className="text-error small" role="alert">{error}</p>}
    </section>
  )
}

// ---------- /reading/:id ----------
export function ReadingTextScreen() {
  const { id } = useParams()
  const t = useText(id ?? '')
  const navigate = useNavigate()
  const toast = useToast()
  const { playing } = useAudio()
  const best = useReadingProgress()
  const [showEn, setShowEn] = useState(false)
  // The tapped word: which paragraph and token, so only that one is highlighted.
  const [sel, setSel] = useState<{ p: number; i: number; word: string } | null>(null)
  useEffect(() => () => audio.stop(), [])

  if (t === undefined) return <main className="screen"><p className="muted">Loading…</p></main>
  if (!t) return <Navigate to="/reading" replace />
  const ids = t.paragraphs.map(p => p.id)
  const allId = `${t.id}-all`
  const all = !!playing && (ids.includes(playing) || playing === allId)
  const b = best?.[readingStep(t.id)]
  // AI texts have no recordings: the phone's Portuguese voice reads them.
  const playPara = (p: { id: string; pt: string }) => (t.tts ? audio.speak(p.id, p.pt) : audio.play(p.id))
  const playAll = () => (t.tts ? audio.speak(allId, t.paragraphs.map(p => p.pt).join(' ')) : audio.playAll(ids))

  return (
    <main className="screen reading">
      <div className="step-head">
        <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/reading">‹ Reading</Link>
        <SlowToggle />
      </div>
      <p className="section-label" style={{ marginTop: 12, marginBottom: 4 }}>Reading · <span className="level-tag">{t.level}</span></p>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>{t.emoji} {t.title}</h1>
      <p className="muted">{t.en}</p>

      <div className="read-controls">
        <button className={'btn ' + (all ? 'btn-primary' : 'btn-tonal')} onClick={() => (all ? audio.stop() : playAll())}>
          {all ? '■ Stop' : '▶ Listen to all'}
        </button>
        <button className={'btn ' + (showEn ? 'btn-primary' : 'btn-tonal')} onClick={() => setShowEn(v => !v)}>
          {showEn ? 'Hide English' : 'Show English'}
        </button>
      </div>
      <p className="muted small" style={{ marginBottom: 8 }}>Tap a word to see what it means.</p>

      {t.paragraphs.map((p, pi) => {
        const on = playing === p.id
        return (
          <div key={p.id} className={'para' + (on ? ' playing' : '')}>
            <button className="audio-icon para-play" onClick={() => playPara(p)} aria-label={`Play paragraph ${pi + 1}`}>{on ? '🔊' : '▶'}</button>
            <div>
              <p className="para-pt" lang="pt-PT">
                {tokens(p.pt).map((tk, i) => tk.word ? (
                  <button
                    key={i}
                    className={'word' + (sel?.p === pi && sel.i === i ? ' on' : '')}
                    onClick={() => setSel(s => (s?.p === pi && s.i === i ? null : { p: pi, i, word: tk.text }))}
                  >{tk.text}</button>
                ) : <span key={i}>{tk.text}</span>)}
              </p>
              {showEn && <p className="para-en">{p.en}</p>}
            </div>
          </div>
        )
      })}

      {!!t.notes?.length && (
        <section className="notes">
          <h3>Phrases to notice</h3>
          {t.notes.map(n => (
            <p key={n.pt}><b lang="pt-PT">{n.pt}</b><span>{n.en}</span></p>
          ))}
        </section>
      )}

      <Link className="btn btn-primary btn-block btn-big" style={{ marginTop: 24, textDecoration: 'none' }} to={`/reading/${t.id}/questions`}>
        Answer {t.questions.length} questions ›
        {b !== undefined && <small>Best so far: {Math.round(b * 100)}%</small>}
      </Link>
      {t.tts && (
        <>
          <p className="small muted" style={{ marginTop: 16 }}>Written for you by Gemini on “{(t as ReadingText & { topic?: string }).topic}”. It's read aloud with your iPhone's voice.</p>
          <button className="btn btn-ghost btn-block" onClick={async () => {
            if (!confirm('Delete this text? Your score for it is deleted too.')) return
            try {
              await db.aiTexts.delete(t.id); await db.progress.delete(`-1:${readingStep(t.id)}`)
              toast('Text deleted.'); navigate('/reading', { replace: true })
            } catch (e) { toast(`Couldn't delete: ${(e as Error).message}`, 'error') }
          }}>Delete this text</button>
        </>
      )}

      <AnimatePresence>
        {sel && (
          <motion.div
            key="sheet"
            className="word-sheet"
            role="status"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          >
            <div>
              <b lang="pt-PT">{sel.word}</b>
              <span>{meaning(t, sel.word) ?? 'No meaning saved for this word yet.'}</span>
            </div>
            <button className="btn btn-ghost btn-circle btn-sm" onClick={() => setSel(null)} aria-label="Close">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

// ---------- /reading/:id/questions ----------
export function ReadingQuestions() {
  const { id } = useParams()
  const t = useText(id ?? '')
  if (t === undefined) return <main className="screen"><p className="muted">Loading…</p></main>
  if (!t) return <Navigate to="/reading" replace />
  return <Practice sessionKey={readingStep(t.id)} items={readingQuestions(t)} mode="reading" step={readingStep(t.id)} closeTo={`/reading/${t.id}`} />
}
