import { Link, Navigate, useParams } from 'react-router-dom'
import { a1Content } from '../content'
import { unitSteps } from '../units'
import { audio, useAudio } from '../audio'
import { AudioRow, SlowToggle } from '../components/AudioRow'
import type { Dialogue, Unit } from '../content/types'
import Practice from './Practice'
import { markStepDone } from '../progress'
import { useToast } from '../toast'

export default function UnitStep() {
  const toast = useToast()
  const { n, step } = useParams()
  const unit = a1Content[Number(n)]
  const meta = unitSteps.find(s => s.slug === step)
  if (!unit || !meta?.ready) return <Navigate to={`/unit/${n}`} replace />

  if (step === 'exercises' || step === 'check') return <Practice key={step} unit={unit} mode={step} />

  const i = unitSteps.indexOf(meta)
  const next = unitSteps[i + 1]
  // Reading steps count as done when you move on.
  const done = () => {
    audio.stop()
    markStepDone(unit.n, meta.slug).catch(e => toast(`Couldn't save your progress: ${e.message}`, 'error'))
  }

  return (
    <main className="screen">
      <div className="step-head">
        <Link className="back" to={`/unit/${unit.n}`} onClick={() => audio.stop()}>‹ Unit {unit.n}</Link>
        <SlowToggle />
      </div>
      <h1>{meta.title}</h1>
      {step === 'dialogue' && unit.dialogues.map(d => <DialogueView key={d.title} d={d} />)}
      {step === 'phrases' && <Phrases unit={unit} />}
      {step === 'vocab' && <Vocab unit={unit} />}
      {step === 'grammar' && <GrammarView unit={unit} />}
      {next?.ready && (
        <Link className="btn" to={`/unit/${unit.n}/${next.slug}`} onClick={done} style={{ textDecoration: 'none', marginTop: 20 }}>
          Next: {next.title} ›
        </Link>
      )}
    </main>
  )
}

function DialogueView({ d }: { d: Dialogue }) {
  const { playing } = useAudio()
  const ids = d.lines.map(l => l.id)
  const isPlaying = ids.includes(playing ?? '')
  return (
    <section className="card">
      <h2>{d.title}</h2>
      <p className="muted">{d.en}</p>
      <button className="btn small-btn" onClick={() => (isPlaying ? audio.stop() : audio.playAll(ids))}>
        {isPlaying ? '■ Stop' : '▶ Play whole dialogue'}
      </button>
      {d.lines.map(l => (
        <AudioRow key={l.id} id={l.id} pt={l.pt} en={l.en} extra={<span className="speaker">{d.speakers[l.speaker].name}</span>} />
      ))}
    </section>
  )
}

function Phrases({ unit }: { unit: Unit }) {
  return (
    <section className="card">
      {unit.phrases.map(p => (
        <AudioRow key={p.id} id={p.id} pt={p.pt} en={p.en} extra={p.note && <span className="note">{p.note}</span>} />
      ))}
    </section>
  )
}

function Vocab({ unit }: { unit: Unit }) {
  return (
    <section className="card">
      {unit.vocab.map(v => (
        <AudioRow key={v.id} id={v.id} pt={v.pt} en={v.en} extra={v.note && <span className="note">{v.note}</span>} />
      ))}
    </section>
  )
}

function GrammarView({ unit }: { unit: Unit }) {
  const g = unit.grammar
  return (
    <>
      <section className="card grammar">
        <h2>{g.title}</h2>
        {g.body.map((p, i) => <p key={i}>{p}</p>)}
      </section>
      <section className="card">
        <h2>Examples</h2>
        {g.examples.map(e => <AudioRow key={e.id} id={e.id} pt={e.pt} en={e.en} />)}
      </section>
      {g.epNote && (
        <section className="card ep-note">
          <h2>🇵🇹 Portugal vs Brazil</h2>
          <p>{g.epNote}</p>
        </section>
      )}
    </>
  )
}
