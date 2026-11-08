import { Link, useParams } from 'react-router-dom'
import { a1Units, unitSteps } from '../units'
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

  return (
    <main className="screen">
      <Link className="back" to="/course">‹ Course</Link>
      <h1>{unit.n} · {unit.title}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{unit.scene}</p>
      {unitSteps.map((step, i) => (
        <button
          key={step}
          className="card tap"
          onClick={() => toast(`"${step}" isn't built yet. Lessons arrive in the next update.`)}
        >
          <span className="chev">›</span>
          <h2>{i + 1}. {step}<span className="soon">Soon</span></h2>
        </button>
      ))}
    </main>
  )
}
