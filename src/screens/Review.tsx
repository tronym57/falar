import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type ReviewCard } from '../db'
import { audio, useAudio } from '../audio'
import { playItem } from '../components/AudioRow'
import { buildQueue, cardFaces, intervalLabel, preview, saveGrade, State, syncCards, type CardFace, type Grade } from '../review'
import { useToast } from '../toast'

const GRADE_NAMES = ['Again', 'Hard', 'Good', 'Easy']
/** Cards that come back within this window are shown again in the same session. */
const RETRY_WINDOW = 15 * 60_000

type Loaded = { cards: Record<string, ReviewCard>; faces: Record<string, CardFace>; queue: string[]; total: number; nextDue?: Date }

export default function Review() {
  const toast = useToast()
  const [s, setS] = useState<Loaded | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const { playing } = useAudio()

  useEffect(() => {
    (async () => {
      await syncCards()
      const [cards, custom] = await Promise.all([db.cards.toArray(), db.customWords.toArray()])
      const faces = cardFaces(custom)
      const known = cards.filter(c => faces[c.id])
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
          {reviewed > 0 && <p className="score">{reviewed}</p>}
          <p className="muted">
            {reviewed > 0 ? 'cards reviewed. ' : ''}
            {Object.keys(s.cards).length === 0
              ? 'Words enter your review when you finish a unit’s Key phrases or Vocabulary step.'
              : nextDue
                ? `Next card is due in ${intervalLabel(nextDue, new Date())}.`
                : 'Come back tomorrow for new words.'}
          </p>
        </div>
        <Link className="btn" to="/" style={{ textDecoration: 'none' }}>Back to Home</Link>
      </main>
    )
  }

  const card = s.cards[s.queue[0]]
  const face = s.faces[card.id]
  // New and learning cards: Portuguese → English (recognise). Known cards: English → Portuguese (recall).
  const recall = card.fsrs.state === State.Review || card.fsrs.state === State.Relearning
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
  return (
    <main className="screen practice">
      <div className="practice-head">
        <Link className="close tap" to="/" aria-label="Close (reviews so far are saved)">✕</Link>
        <div className="progress grow"><div style={{ width: `${((s.total - left) / Math.max(s.total, 1)) * 100}%` }} /></div>
        <span className="muted count">{left} left</span>
      </div>

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
          <button className="btn" onClick={reveal}>Show answer</button>
        ) : (
          <div className="grades">
            {options.map(o => (
              <button key={o.grade} className={`grade g${o.grade} tap`} onClick={() => rate(o.grade)}>
                <b>{GRADE_NAMES[o.grade - 1]}</b>
                <span>{intervalLabel(o.due, now)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

/** Plays a card's audio once when it appears (Portuguese-first cards only). */
function AutoPlay({ id, when, play }: { id: string; when: boolean; play: () => void }) {
  useEffect(() => { if (when) play() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps -- once per card
  return null
}
