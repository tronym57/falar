import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { audio, useAudio } from '../audio'
import { SlowToggle } from '../components/AudioRow'
import { meaning, readingById, readingQuestions, readingStep, readingTexts, tokens } from '../content/reading'
import Practice from './Practice'

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
  return (
    <main className="screen">
      <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice">‹ Practice</Link>
      <h1>Reading</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Short texts about life around Peniche. Tap any word to see what it means.</p>
      {readingTexts.map(t => {
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
          </Link>
        )
      })}
    </main>
  )
}

// ---------- /reading/:id ----------
export function ReadingTextScreen() {
  const { id } = useParams()
  const t = readingById(id ?? '')
  const { playing } = useAudio()
  const best = useReadingProgress()
  const [showEn, setShowEn] = useState(false)
  // The tapped word: which paragraph and token, so only that one is highlighted.
  const [sel, setSel] = useState<{ p: number; i: number; word: string } | null>(null)
  useEffect(() => () => audio.stop(), [])

  if (!t) return <Navigate to="/reading" replace />
  const ids = t.paragraphs.map(p => p.id)
  const all = !!playing && ids.includes(playing)
  const b = best?.[readingStep(t.id)]

  return (
    <main className="screen reading">
      <div className="step-head">
        <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/reading">‹ Reading</Link>
        <SlowToggle />
      </div>
      <h1 style={{ marginTop: 12, marginBottom: 8 }}>{t.emoji} {t.title}</h1>
      <p className="muted">{t.en}</p>

      <div className="read-controls">
        <button className={'btn ' + (all ? 'btn-primary' : 'btn-tonal')} onClick={() => (all ? audio.stop() : audio.playAll(ids))}>
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
            <button className="audio-icon para-play" onClick={() => audio.play(p.id)} aria-label={`Play paragraph ${pi + 1}`}>{on ? '🔊' : '▶'}</button>
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

      <Link className="btn btn-primary btn-block btn-big" style={{ marginTop: 24, textDecoration: 'none' }} to={`/reading/${t.id}/questions`}>
        Answer {t.questions.length} questions ›
        {b !== undefined && <small>Best so far: {Math.round(b * 100)}%</small>}
      </Link>

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
  const t = readingById(id ?? '')
  if (!t) return <Navigate to="/reading" replace />
  return <Practice sessionKey={readingStep(t.id)} items={readingQuestions(t)} mode="reading" step={readingStep(t.id)} closeTo={`/reading/${t.id}`} />
}
