import { Link } from 'react-router-dom'
import { a1Units } from '../units'
import { useToast } from '../toast'

const standalone =
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches

export default function Home() {
  const toast = useToast()
  const next = a1Units[0]
  return (
    <main className="screen">
      <h1>Olá! 👋</h1>

      {!standalone && (
        <div className="card">
          <h2>Install the app</h2>
          <p className="muted">Tap Share → <b>Add to Home Screen</b>, then open Falar from the icon. Your progress is saved there, not in this browser tab.</p>
        </div>
      )}

      <Link className="btn" to={`/unit/${next.n}`} style={{ textDecoration: 'none' }}>
        Continue: Unit {next.n} · {next.title}
        <small>{next.scene}</small>
      </Link>

      <button
        className="card tap"
        style={{ marginTop: 12 }}
        onClick={() => toast('Nothing to review yet. Words you learn in the units show up here.')}
      >
        <span className="chev">›</span>
        <h2>Daily review</h2>
        <p className="muted">Nothing due yet</p>
      </button>
    </main>
  )
}
