import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { a1Content } from '../content'
import { AudioRow, SlowToggle } from '../components/AudioRow'
import { lookDrill, lookPairs, pairOpen } from '../lookalikes'
import { useDone } from '../learned'
import { useToast } from '../toast'
import { startDrill } from './Verbs'

// ---------- /practice/lookalikes ----------
export default function LookAlikes() {
  const toast = useToast()
  const navigate = useNavigate()
  const done = useDone()
  const open = done ? lookPairs.filter(p => pairOpen(p, done)) : []
  // Locked pairs you chose to look at anyway: shown here, but not in the drill.
  const [peek, setPeek] = useState<string[]>([])

  const practise = async () => {
    if (!open.length) return toast('No pairs open yet. Each pair opens with the Key phrases of its unit.')
    try { await startDrill('lookalikes', lookDrill(open, 15), navigate, lookDrill(open, 999)) }
    catch (e) { toast(`Couldn't start the drill: ${(e as Error).message}`, 'error') }
  }

  return (
    <main className="screen">
      <div className="step-head">
        <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice">‹ Practice</Link>
        <SlowToggle />
      </div>
      <h1>Look-alikes</h1>
      <p className="muted" style={{ marginBottom: 12 }}>Words that only differ by an accent, but mean and sound different. Listen to both, then practise hearing and using the right one.</p>

      <button className="btn btn-primary btn-block btn-big" onClick={practise} style={{ marginBottom: 32 }}>
        Practise<small>{open.length ? `${open.length} open ${open.length === 1 ? 'pair' : 'pairs'}: hear it, fill the gap, meaning` : 'No open pairs yet'}</small>
      </button>

      {lookPairs.map(p => {
        const isOpen = !!done && pairOpen(p, done)
        if (!isOpen && !peek.includes(p.id)) return (
          <button key={p.id} className="card tap soft-locked look-locked"
            onClick={() => { if (confirm(`This pair opens with the Key phrases of Unit ${p.unit}${a1Content[p.unit] ? '' : ' (not built yet)'}. Until then it isn't in the drill.\n\nOK shows it anyway.`)) setPeek([...peek, p.id]) }}>
            <h2>{p.words[0].pt} <span className="muted" style={{ fontWeight: 400 }}>/</span> {p.words[1].pt}</h2>
            <span className="badge badge-sm badge-soft">🔒 Unit {p.unit}</span>
          </button>
        )
        return (
          <section key={p.id} className="card">
            <h2 style={{ marginBottom: 2 }}>{p.words[0].pt} <span className="muted" style={{ fontWeight: 400 }}>/</span> {p.words[1].pt}</h2>
            <p className="muted small" style={{ marginBottom: 8 }}>{p.why}</p>
            {p.words.map(w => (
              <div key={w.pt} className="look-word">
                <h3><span lang="pt-PT">{w.pt}</span> <span className="muted" style={{ fontWeight: 400 }}>= {w.en}</span></h3>
                <p className="small muted">🔈 {w.sound}</p>
                {w.examples.map(x => <AudioRow key={x.id} id={x.id} pt={x.pt} en={x.en} />)}
              </div>
            ))}
          </section>
        )
      })}
    </main>
  )
}
