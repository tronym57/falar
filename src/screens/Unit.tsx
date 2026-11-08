import { Link, useParams } from 'react-router-dom'
import { a1Units, unitSteps } from '../units'
import { a1Content } from '../content'
import { useToast } from '../toast'
import { useUnitProgress } from '../progress'

export default function Unit() {
  const toast = useToast()
  const { n } = useParams()
  const unit = a1Units.find(u => String(u.n) === n)
  const progress = useUnitProgress(Number(n))

  if (!unit) {
    return (
      <main className="screen">
        <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/course">‹ Course</Link>
        <h1>Unit not found</h1>
        <div className="card border-error"><p>This unit doesn't exist. Pick one from the course list.</p></div>
      </main>
    )
  }

  const hasContent = !!a1Content[unit.n]

  return (
    <main className="screen">
      <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/course">‹ Course</Link>
      <p className="section-label" style={{ marginTop: 12, marginBottom: 4 }}>Unit {unit.n}</p>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>{unit.title}</h1>
      <p className="muted" style={{ marginBottom: 24 }}>{unit.scene}</p>
      <div className="card step-list">
        {unitSteps.map((step, i) => {
          const p = progress?.[step.slug]
          const open = hasContent && step.ready
          const inner = (
            <>
              <span className="flex items-center gap-3">
                <span className={'unit-n' + (p?.done ? ' done' : '')}>{p?.done ? '✓' : i + 1}</span>
                <span>
                  <span className="step-title">{step.title}</span>
                  {p?.bestScore !== undefined && <span className="muted small block">Best: {Math.round(p.bestScore * 100)}%</span>}
                </span>
              </span>
              {open ? <span className="step-chev">›</span> : <span className="badge badge-sm badge-ghost">Soon</span>}
            </>
          )
          return open ? (
            <Link key={step.slug} to={`/unit/${unit.n}/${step.slug}`} className="row tap step-row">{inner}</Link>
          ) : (
            <button
              key={step.slug}
              className="row tap step-row locked-row"
              onClick={() =>
                toast(hasContent
                  ? `"${step.title}" isn't built yet. It arrives in a later update.`
                  : `Unit ${unit.n}'s lessons aren't written yet. Start with Unit 0.`)
              }
            >{inner}</button>
          )
        })}
      </div>
    </main>
  )
}
