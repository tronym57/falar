import { Link } from 'react-router-dom'
import { a1Units, v1UnitCount } from '../units'
import { useToast } from '../toast'

export default function Course() {
  const toast = useToast()
  return (
    <main className="screen">
      <h1>A1 course</h1>
      {a1Units.map(u =>
        u.n < v1UnitCount ? (
          <Link key={u.n} to={`/unit/${u.n}`} className="card tap">
            <span className="chev">›</span>
            <h2>{u.n} · {u.title}</h2>
            <p className="muted">{u.scene}</p>
            <div className="progress"><div style={{ width: '0%' }} /></div>
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
