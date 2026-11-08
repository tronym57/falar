import { a1Content } from '../content'
import { AudioRow, SlowToggle } from '../components/AudioRow'

export default function Vocab() {
  const units = Object.values(a1Content).sort((a, b) => a.n - b.n)
  return (
    <main className="screen">
      <div className="step-head"><h1 style={{ margin: 0 }}>Vocabulary</h1><SlowToggle /></div>
      {units.map(u => (
        <section key={u.id} className="card">
          <h2>Unit {u.n} · {u.title}</h2>
          <p className="muted">Phrases</p>
          {u.phrases.map(p => <AudioRow key={p.id} id={p.id} pt={p.pt} en={p.en} />)}
          <p className="muted" style={{ marginTop: 12 }}>Words</p>
          {u.vocab.map(v => <AudioRow key={v.id} id={v.id} pt={v.pt} en={v.en} />)}
        </section>
      ))}
    </main>
  )
}
