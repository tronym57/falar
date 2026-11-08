import { Link } from 'react-router-dom'
import { a1Units } from '../units'
import { a1Content } from '../content'
import { nextStep, useAllProgress } from '../progress'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { buildQueue, cardFaces } from '../review'
import { useToast } from '../toast'

const standalone =
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches

export default function Home() {
  const toast = useToast()
  const all = useAllProgress()
  const due = useLiveQuery(async () => {
    const faces = cardFaces(await db.customWords.toArray())
    const cards = (await db.cards.toArray()).filter(c => faces[c.id])
    return { count: buildQueue(cards, new Date()).length, total: cards.length }
  })

  // First unit with content that still has an unfinished step.
  const target = all && a1Units
    .filter(u => a1Content[u.n])
    .map(u => ({ u, step: nextStep(u.n, all.progress) }))
    .find(x => x.step)
  const session = target && all.sessions.find(s => s.key === `${target.u.n}:${target.step!.slug}`)

  return (
    <main className="screen">
      <h1>Olá! 👋</h1>

      {!standalone && (
        <div className="card">
          <h2>Install the app</h2>
          <p className="muted">Tap Share → <b>Add to Home Screen</b>, then open Falar from the icon. Your progress is saved there, not in this browser tab.</p>
        </div>
      )}

      {!all ? null : target ? (
        <Link className="btn" to={`/unit/${target.u.n}/${target.step!.slug}`} style={{ textDecoration: 'none' }}>
          Continue: Unit {target.u.n} · {target.step!.title}
          <small>
            {session
              ? `Exercise ${session.total - new Set(session.queue).size + 1} of ${session.total}`
              : `${target.u.title}`}
          </small>
        </Link>
      ) : (
        <button className="btn" onClick={() => toast('New units are on their way. Meanwhile, replay any unit from the Course tab.')}>
          All available units done 🎉
          <small>More units coming</small>
        </button>
      )}

      {due && due.count > 0 ? (
        <Link className="card tap" to="/review" style={{ marginTop: 12 }}>
          <span className="chev">›</span>
          <h2>Daily review</h2>
          <p className="muted">{due.count} {due.count === 1 ? 'card' : 'cards'} to review</p>
        </Link>
      ) : (
        <button
          className="card tap"
          style={{ marginTop: 12 }}
          onClick={() => toast(due?.total
            ? 'All caught up. Words come back when it’s time to repeat them.'
            : 'Words enter your review when you finish a unit’s Key phrases or Vocabulary step.')}
        >
          <span className="chev">›</span>
          <h2>Daily review</h2>
          <p className="muted">{due?.total ? 'All caught up ✓' : 'No words yet'}</p>
        </button>
      )}
    </main>
  )
}
