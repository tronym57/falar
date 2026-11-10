import { Link, useParams } from 'react-router-dom'
import { a1Units, unitSteps } from '../units'
import { a1Content } from '../content'
import { useToast } from '../toast'
import { lessonKey, markStepNotDone, useUnitProgress } from '../progress'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function Unit() {
  const toast = useToast()
  const { n } = useParams()
  const unit = a1Units.find(u => String(u.n) === n)
  const progress = useUnitProgress(Number(n))
  const sessions = useLiveQuery(() => db.sessions.toArray())

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
          // Unfinished practice for this step (the step's own exercises, or its lesson practice).
          const found = sessions?.find(x => x.key === `${unit.n}:${step.slug}` || x.key === lessonKey(unit.n, step.slug))
          // Only counts as in progress once at least one question is answered,
          // and, for a done step, only a practice started after it was done.
          const stale = !!found && !!p?.done && found.startedAt < p.updatedAt
          const answered = found && !stale ? Object.keys(found.firstTry).length : 0
          const s = answered > 0 ? found : undefined
          const sub = s
            ? `In progress · ${answered} of ${s.total} answered`
            : p?.bestScore !== undefined ? `Best: ${Math.round(p.bestScore * 100)}%` : null

          if (!open) {
            return (
              <button
                key={step.slug}
                className="row tap step-row locked-row"
                onClick={() => toast(hasContent
                  ? `"${step.title}" isn't built yet. It arrives in a later update.`
                  : `Unit ${unit.n}'s lessons aren't written yet. Start with Unit 0.`)}
              >
                <span className="flex items-center gap-3"><span className="unit-n">{i + 1}</span><span className="step-title">{step.title}</span></span>
                <span className="badge badge-sm badge-ghost">Soon</span>
              </button>
            )
          }
          return (
            <div key={step.slug} className="row step-row">
              {p?.done ? (
                <button className="unit-n done tap-badge" aria-label={`${step.title} is done. Tap to mark as not done.`} onClick={async () => {
                  if (!confirm(`Mark "${step.title}" as not done? Your best score and review words are kept.`)) return
                  try { await markStepNotDone(unit.n, step.slug); toast(`${step.title} marked as not done.`) }
                  catch (e) { toast(`Couldn't save: ${(e as Error).message}`, 'error') }
                }}>✓</button>
              ) : (
                <span className={'unit-n' + (s ? ' in-progress' : '')}>{i + 1}</span>
              )}
              <Link to={`/unit/${unit.n}/${step.slug}`} className="tap step-link">
                <span>
                  <span className="step-title">{step.title}</span>
                  {sub && <span className={'small block ' + (s ? 'text-warning' : 'muted')}>{sub}</span>}
                </span>
                <span className="step-chev">›</span>
              </Link>
            </div>
          )
        })}
      </div>
      <p className="muted small" style={{ textAlign: 'center', marginTop: 4 }}>Tap a ✓ to mark a step as not done.</p>
    </main>
  )
}
