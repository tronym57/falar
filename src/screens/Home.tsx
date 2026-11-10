import { Link } from 'react-router-dom'
import { a1Units } from '../units'
import { a1Content } from '../content'
import { nextStep, useAllProgress } from '../progress'
import { useDue } from '../review'
import { useToast } from '../toast'
import { StreakCard } from '../components/Streak'
import { useAi } from '../ai'
import { dailyPhrase, greeting } from '../greeting'

const standalone =
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches

export default function Home() {
  const toast = useToast()
  const all = useAllProgress()
  const due = useDue()
  const { name } = useAi()
  const phrase = dailyPhrase()

  // First unit with content that still has an unfinished step.
  const target = all && a1Units
    .filter(u => a1Content[u.n])
    .map(u => ({ u, step: nextStep(u.n, all.progress) }))
    .find(x => x.step)
  const session = target && all.sessions.find(s => s.key === `${target.u.n}:${target.step!.slug}`)

  return (
    <main className="screen">
      <h1 style={{ marginBottom: 2 }}>{greeting(name)} 👋</h1>
      <p className="muted" style={{ marginBottom: 16 }}><span lang="pt-PT">{phrase.pt}</span> · {phrase.en}</p>
      <StreakCard />

      {!standalone && (
        <div className="card">
          <h2>Install the app</h2>
          <p className="muted">Tap Share → <b>Add to Home Screen</b>, then open Falo Português from the icon. Your progress is saved there, not in this browser tab.</p>
        </div>
      )}

      {!all ? null : target ? (
        <Link className="hero-cta" to={`/unit/${target.u.n}/${target.step!.slug}`}>
          <span className="eyebrow">Unit {target.u.n} · {target.u.title}</span>
          <span className="title">{target.step!.title}</span>
          <span className="sub">
            {session && Object.keys(session.firstTry).length ? `${Object.keys(session.firstTry).length} of ${session.total} answered` : target.u.scene}
          </span>
          <br />
          <span className="go">Continue ›</span>
        </Link>
      ) : (
        <button className="hero-cta" onClick={() => toast('New units are on their way. Meanwhile, replay any unit from the Course tab.')}>
          <span className="eyebrow">Course</span>
          <span className="title">All available units done 🎉</span>
          <span className="sub">More units are coming</span>
        </button>
      )}

      <p className="section-label">Practice</p>

      {due && due.count > 0 ? (
        <Link className="card tap" to="/review">
          <span className="chev">›</span>
          <h2>🗂️ Daily review</h2>
          <p className="muted">{due.count} {due.count === 1 ? 'card' : 'cards'} · about {Math.max(1, Math.round(due.count / 3))} min</p>
        </Link>
      ) : (
        <button
          className="card tap"
          onClick={() => toast(due?.total
            ? 'All caught up. Words come back when it’s time to repeat them.'
            : 'Words enter your review when you finish a unit’s Key phrases or Vocabulary step.')}
        >
          <span className="chev">›</span>
          <h2>🗂️ Daily review</h2>
          <p className="muted">{due?.total ? 'All caught up ✓' : 'No words yet'}</p>
        </button>
      )}
    </main>
  )
}
