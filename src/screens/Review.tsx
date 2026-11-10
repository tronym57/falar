import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { db, type ReviewCard } from '../db'
import { audio, useAudio } from '../audio'
import { playItem } from '../components/AudioRow'
import { buildQueue, isReverse, wordId, cardFaces, intervalLabel, preview, saveGrade, State, syncCards, isGrammarCard, grammarExercise, showable, Rating, type CardFace, type Grade } from '../review'
import type { Exercise } from '../content/types'
import { ExerciseView, type Answer } from '../components/Exercises'
import { freshen } from '../rounds'
import { rng } from '../test'
import { playChime } from '../chime'
import { translationOf } from '../translation'
import { useToast } from '../toast'
import { StreakLine } from '../components/Streak'

// Grades, in plain words. The grade decides when the card comes back (not shown: it's noise).
const GRADE_NAMES = ['Forgot', 'Hard', 'Good', 'Easy']
const GRADE_CLASS = ['btn-miss', 'btn-warning', 'btn-success', 'btn-info']
/** Cards that come back within this window are shown again in the same session. */
const RETRY_WINDOW = 15 * 60_000

type Loaded = { cards: Record<string, ReviewCard>; faces: Record<string, CardFace>; queue: string[]; total: number; nextDue?: Date }

export default function Review() {
  const toast = useToast()
  // Close returns to where you opened the review from (Practice or Home).
  const from = (useLocation().state as { from?: string } | null)?.from === '/practice' ? '/practice' : '/'
  const [s, setS] = useState<Loaded | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const { playing } = useAudio()

  useEffect(() => {
    (async () => {
      await syncCards()
      const [cards, custom] = await Promise.all([db.cards.toArray(), db.customWords.toArray()])
      const faces = cardFaces(custom)
      const known = cards.filter(c => showable(c, faces))
      const now = new Date()
      const queue = buildQueue(known, now)
      const later = known.filter(c => c.fsrs.state !== State.New && new Date(c.fsrs.due) > now).map(c => new Date(c.fsrs.due))
      const nextDue = later.length ? new Date(Math.min(...later.map(Number))) : undefined
      setS({ cards: Object.fromEntries(known.map(c => [c.id, c])), faces, queue, total: queue.length, nextDue })
    })().catch(e => toast(`Couldn't load your review: ${e.message}`, 'error'))
    return () => audio.stop()
  }, [toast])

  if (!s) return <main className="screen"><p className="muted">Loading…</p></main>

  if (!s.queue.length) {
    const later = Object.values(s.cards).filter(c => c.fsrs.state !== State.New).map(c => +new Date(c.fsrs.due))
    const nextDue = later.length ? new Date(Math.min(...later)) : s.nextDue
    return (
      <main className="screen">
        <h1>{reviewed ? 'Done for today ✓' : 'Nothing to review'}</h1>
        <div className="card">
          {reviewed > 0 && <p className="text-5xl font-extrabold text-primary mb-2">{reviewed}</p>}
          <p className="muted">
            {reviewed > 0 ? 'cards reviewed. ' : ''}
            {Object.keys(s.cards).length === 0
              ? 'Words enter your review when you finish a unit’s Key phrases or Vocabulary step. Grammar questions you miss in practice join them.'
              : nextDue
                ? `Next card is due in ${intervalLabel(nextDue, new Date())}.`
                : 'Come back tomorrow for new words.'}
          </p>
          {reviewed > 0 && <StreakLine />}
        </div>
        <Link className="btn btn-primary btn-block btn-big" to={from} style={{ textDecoration: 'none' }}>Back to {from === '/practice' ? 'Practice' : 'Home'}</Link>
      </main>
    )
  }

  const card = s.cards[s.queue[0]]
  const face = s.faces[wordId(card.id)]
  // Each word has two cards: Portuguese → English, and English → Portuguese (id ends in ~en).
  const recall = isReverse(card.id)
  const play = () => playItem(face.id, face.custom ? face.pt : undefined)
  const now = new Date()
  const options = preview(card.fsrs, now)

  const reveal = () => { setRevealed(true); if (recall) play() }

  const rate = async (g: Grade) => {
    try {
      const next = await saveGrade(card, g)
      const queue = s.queue.slice(1)
      if (+new Date(next.fsrs.due) - Date.now() < RETRY_WINDOW) queue.push(card.id)
      setS({ ...s, cards: { ...s.cards, [card.id]: next }, queue })
      setReviewed(r => r + 1)
      setRevealed(false)
      audio.stop()
    } catch (e) {
      toast(`Couldn't save this review: ${(e as Error).message}`, 'error')
    }
  }

  const left = new Set(s.queue).size
  const head = (
    <div className="practice-head">
      <Link className="btn btn-ghost btn-circle btn-sm text-xl" to={from} aria-label="Close (reviews so far are saved)">✕</Link>
      <progress className="progress progress-primary" value={s.total - left} max={Math.max(s.total, 1)} />
      <span className="muted count">{left} left</span>
    </div>
  )

  // Grammar you missed in practice: answer the question itself; the app grades it.
  const gex = isGrammarCard(card.id) ? grammarExercise(card) : undefined
  if (gex) return (
    <main className="screen practice">
      {head}
      <GrammarCard key={`${card.id}:${reviewed}`} ex={gex} unit={card.unit} onGrade={rate} />
    </main>
  )

  return (
    <main className="screen practice">
      {head}

      <AutoPlay id={face.id} when={!recall && !face.custom} play={() => audio.autoplay(face.id)} />

      <div className="flashcard">
        <p className="ex-label">{recall ? 'How do you say this in Portuguese?' : 'What does this mean?'}</p>
        {recall ? <p className="flash-main">{face.en}</p> : (
          <button className={'flash-main flash-audio tap' + (playing === face.id ? ' playing' : '')} onClick={play}>
            {face.pt} <span aria-hidden>{playing === face.id ? '🔊' : '▶'}</span>
          </button>
        )}
        {revealed && (
          <div className="flash-answer">
            {recall ? (
              <button className={'flash-audio tap' + (playing === face.id ? ' playing' : '')} onClick={play}>
                {face.pt} <span aria-hidden>{playing === face.id ? '🔊' : '▶'}</span>
              </button>
            ) : <p>{face.en}</p>}
            {face.note && <p className="note">{face.note}</p>}
          </div>
        )}
      </div>

      <div className="grade-bar">
        {!revealed ? (
          <button className="btn btn-primary btn-block btn-big" onClick={reveal}>Show answer</button>
        ) : (
          <>
            <p className="grade-help"><b>How well did you know it?</b></p>
            <div className="grades">
              {options.map(o => (
                <button key={o.grade} className={`btn grade ${GRADE_CLASS[o.grade - 1]}`} onClick={() => rate(o.grade)}>
                  {GRADE_NAMES[o.grade - 1]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

/** A grammar question you missed in practice. Right → Good, wrong → Again (it comes back soon). */
function GrammarCard({ ex, unit, onGrade }: { ex: Exercise; unit: number; onGrade: (g: Grade) => void }) {
  const [answer, setAnswer] = useState<Answer | null>(null)
  const shown = useMemo(() => freshen(ex, rng(Date.now())), [ex])
  const t = translationOf(shown)
  const ok = !!answer?.result.ok
  return (
    <>
      <p className="section-label">Grammar you missed{unit >= 0 ? ` · Unit ${unit}` : ''}</p>
      <ExerciseView ex={shown} locked={!!answer} onAnswer={a => { setAnswer(a); if (a.result.ok) playChime() }} />
      {answer && (
        <div className={'feedback ' + (ok ? 'ok' : 'bad')} role="status">
          <b>{ok ? 'Correct! ✓' : 'Not quite'}</b>
          {answer.result.ok && answer.result.note && <p>{answer.result.note}</p>}
          {!ok && <p>Correct answer: <b>{answer.result.expected}</b></p>}
          {t && <p className="meaning"><b lang="pt-PT">{t.pt}</b> = {t.en}</p>}
          <p className="small">{ok ? 'It comes back later, with a longer gap each time you get it right.' : 'It comes back again soon.'}</p>
          <button className={'btn btn-block btn-big ' + (ok ? 'btn-success' : 'btn-miss')} onClick={() => onGrade(ok ? Rating.Good : Rating.Again)}>Continue</button>
        </div>
      )}
    </>
  )
}

/** Plays a card's audio once when it appears (Portuguese-first cards only). */
function AutoPlay({ id, when, play }: { id: string; when: boolean; play: () => void }) {
  useEffect(() => { if (when) play() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps -- once per card
  return null
}
