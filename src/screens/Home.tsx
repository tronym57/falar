import { Link } from 'react-router-dom'
import { a1Units } from '../units'
import { a1Content } from '../content'
import { nextStep, useAllProgress } from '../progress'
import { useToast } from '../toast'

const standalone =
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches

export default function Home() {
  const toast = useToast()
  const all = useAllProgress()

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

      <button
        className="card tap"
        style={{ marginTop: 12 }}
        onClick={() => toast('Daily review arrives in a later update. It will bring back words at the right time.')}
      >
        <span className="chev">›</span>
        <h2>Daily review</h2>
        <p className="muted">Coming soon</p>
      </button>
    </main>
  )
}
