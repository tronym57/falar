import { Link, useParams } from 'react-router-dom'
import { a1Units, unitSteps } from '../units'
import { a1Content } from '../content'
import { useToast } from '../toast'

export default function Unit() {
  const toast = useToast()
  const { n } = useParams()
  const unit = a1Units.find(u => String(u.n) === n)

  if (!unit) {
    return (
      <main className="screen">
        <Link className="back" to="/course">‹ Course</Link>
        <h1>Unit not found</h1>
        <div className="card error-card"><p>This unit doesn't exist. Pick one from the course list.</p></div>
      </main>
    )
  }

  const hasContent = !!a1Content[unit.n]

  return (
    <main className="screen">
      <Link className="back" to="/course">‹ Course</Link>
      <h1>{unit.n} · {unit.title}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{unit.scene}</p>
      {unitSteps.map((step, i) =>
        hasContent && step.ready ? (
          <Link key={step.slug} to={`/unit/${unit.n}/${step.slug}`} className="card tap">
            <span className="chev">›</span>
            <h2>{i + 1}. {step.title}</h2>
          </Link>
        ) : (
          <button
            key={step.slug}
            className="card tap"
            onClick={() =>
              toast(hasContent
                ? `"${step.title}" isn't built yet. It arrives in a later update.`
                : `Unit ${unit.n}'s lessons aren't written yet. Start with Unit 0.`)
            }
          >
            <span className="chev">›</span>
            <h2>{i + 1}. {step.title}<span className="soon">Soon</span></h2>
          </button>
        ),
      )}
    </main>
  )
}
