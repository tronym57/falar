import { a1Units } from '../units'

const standalone =
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches

export default function Home() {
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

      <button className="btn" disabled>
        Continue: Unit {next.n} · {next.title}
        <small>Lessons arrive in the next update</small>
      </button>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Daily review</h2>
        <p className="muted">Nothing due yet. Words you learn show up here.</p>
      </div>
    </main>
  )
}
