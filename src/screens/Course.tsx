import { Link } from 'react-router-dom'
import { a1Units, v1UnitCount } from '../units'
import { useToast } from '../toast'
import { unitDoneCount, useAllProgress } from '../progress'
import { unitSteps } from '../units'

export default function Course() {
  const toast = useToast()
  const all = useAllProgress()
  return (
    <main className="screen">
      <h1>A1 course</h1>
      {a1Units.map(u =>
        u.n < v1UnitCount ? (
          <Link key={u.n} to={`/unit/${u.n}`} className="card tap">
            <span className="chev">›</span>
            <h2>{u.n} · {u.title}{all?.progress.some(p => p.unit === u.n && p.step === 'check' && p.done) && <span className="done-mark"> ✓</span>}</h2>
            <p className="muted">{u.scene}</p>
            <div className="progress"><div style={{ width: `${(unitDoneCount(u.n, all?.progress ?? []) / unitSteps.length) * 100}%` }} /></div>
          </Link>
        ) : (
          <button
            key={u.n}
            className="card tap locked"
            onClick={() => toast(`Unit ${u.n} isn't built yet. Units 0–3 come first.`)}
          >
            <h2>{u.n} · {u.title}</h2>
            <p className="muted">Coming later</p>
          </button>
        ),
      )}
    </main>
  )
}
