import { Link } from 'react-router-dom'
import { a1Units, v1UnitCount } from '../units'
import { useToast } from '../toast'
import { unitDoneCount, useAllProgress } from '../progress'
import { unitSteps } from '../units'

export default function Course() {
  const toast = useToast()
  const all = useAllProgress()
  const available = a1Units.filter(u => u.n < v1UnitCount)
  const later = a1Units.filter(u => u.n >= v1UnitCount)

  return (
    <main className="screen">
      <h1>A1 course</h1>
      {available.map(u => {
        const done = !!all?.progress.some(p => p.unit === u.n && p.step === 'check' && p.done)
        const steps = unitDoneCount(u.n, all?.progress ?? [])
        return (
          <Link key={u.n} to={`/unit/${u.n}`} className="card tap">
            <span className="chev">›</span>
            <div className="unit-head">
              <span className={'unit-n' + (done ? ' done' : '')}>{done ? '✓' : u.n}</span>
              <h2>{u.title}</h2>
            </div>
            <p className="muted" style={{ marginLeft: 44 }}>{u.scene}</p>
            <div className="flex items-center gap-3" style={{ marginLeft: 44, marginTop: 10 }}>
              <progress className="progress progress-primary" value={steps} max={unitSteps.length} />
              <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{steps}/{unitSteps.length}</span>
            </div>
          </Link>
        )
      })}

      <p className="section-label">Later in A1</p>
      <div className="card">
        {later.map(u => (
          <button key={u.n} className="row tap locked-row" onClick={() => toast(`Unit ${u.n} isn't built yet. Units 0–3 come first.`)}>
            <span className="flex items-center gap-3"><span className="unit-n">{u.n}</span>{u.title}</span>
            <span className="badge badge-sm badge-ghost">Soon</span>
          </button>
        ))}
      </div>
    </main>
  )
}
