import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { a1Content } from '../content'
import { unitSteps } from '../units'
import { audio, useAudio } from '../audio'
import { AudioRow, SlowToggle } from '../components/AudioRow'
import type { Dialogue, Exercise, Unit } from '../content/types'
import { db } from '../db'
import { LESSON_LENGTH, lessonQuestions } from '../test'
import { GrammarTopicView } from '../components/Grammar'
import Practice from './Practice'
import { PASS_MARK, lessonKey, markStepDone, markStepNotDone, useUnitProgress } from '../progress'
import { useToast } from '../toast'

export default function UnitStep() {
  const toast = useToast()
  const { n, step } = useParams()
  const unit = a1Content[Number(n)]
  const meta = unitSteps.find(s => s.slug === step)
  const progress = useUnitProgress(Number(n))
  if (!unit || !meta?.ready) return <Navigate to={`/unit/${n}`} replace />

  if (step === 'exercises' || step === 'check') {
    return <Practice key={step} sessionKey={`${unit.n}:${step}`} items={step === 'exercises' ? unit.exercises : unit.check} mode={step} unit={unit.n} closeTo={`/unit/${unit.n}`} />
  }

  const i = unitSteps.indexOf(meta)
  const next = unitSteps.slice(i + 1).find(s => s.ready)
  const done = !!progress?.[meta.slug]?.done
  const best = progress?.[meta.slug]?.bestScore
  const count = meta.slug === 'grammar' ? unit.grammar.topics.reduce((n, t) => n + t.exercises.length, 0) : LESSON_LENGTH

  const save = async (fn: () => Promise<void>, msg: string) => {
    try { await fn(); toast(msg) } catch (e) { toast(`Couldn't save your progress: ${(e as Error).message}`, 'error') }
  }

  return (
    <main className="screen">
      <div className="step-head">
        <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to={`/unit/${unit.n}`} onClick={() => audio.stop()}>‹ Unit {unit.n}</Link>
        <SlowToggle />
      </div>
      <h1>{meta.title}</h1>

      {done && (
        <div className="status-bar">
          <span><b>✓ Completed</b>{best !== undefined && <span className="muted"> · best {Math.round(best * 100)}%</span>}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => save(() => markStepNotDone(unit.n, meta.slug), `${meta.title} marked as not done.`)}>Mark as not done</button>
        </div>
      )}

      {step === 'dialogue' && unit.dialogues.map(d => <DialogueView key={d.title} d={d} />)}
      {step === 'phrases' && <Phrases unit={unit} />}
      {step === 'vocab' && <Vocab unit={unit} />}
      {step === 'grammar' && <GrammarView unit={unit} />}

      <section className="card practise-card">
        <h2>{done ? 'Practise again' : 'Practise it now'}</h2>
        <p className="muted">
          {count} quick questions on this lesson.{!done && ` Get ${Math.round(PASS_MARK * 100)}% and it's marked as done.`}
        </p>
        <Link className={'btn btn-block btn-big ' + (done ? 'btn-tonal' : 'btn-primary')} to={`/unit/${unit.n}/${meta.slug}/practice`} onClick={() => audio.stop()}>
          {done ? 'Practise again' : 'Practise now'}
        </Link>
        {!done && (
          <button className="btn btn-ghost btn-block mt-2" onClick={() => save(() => markStepDone(unit.n, meta.slug), `${meta.title} marked as done ✓`)}>
            Skip practice, mark as done
          </button>
        )}
      </section>

      {next && (
        <Link className={'btn btn-block btn-big ' + (done ? 'btn-primary' : 'btn-tonal')} to={`/unit/${unit.n}/${next.slug}`} onClick={() => audio.stop()}>
          Next: {next.title} ›
        </Link>
      )}
    </main>
  )
}

/** /unit/:n/:step/practice: practise a reading step; resumes where you left off. */
export function LessonRunner() {
  const { n, step } = useParams()
  const unit = a1Content[Number(n)]
  const [items, setItems] = useState<Exercise[] | null | undefined>(undefined)
  useEffect(() => {
    if (!unit || !step) { setItems(null); return }
    const key = lessonKey(unit.n, step)
    db.sessions.get(key).then(async s => {
      if (s?.items?.length && s.queue.length) return setItems(s.items)
      const fresh = lessonQuestions(unit, step)
      await db.sessions.put({ key, queue: fresh.map(x => x.id), total: fresh.length, firstTry: {}, startedAt: new Date().toISOString(), items: fresh })
      setItems(fresh)
    }).catch(() => setItems(null))
  }, [unit, step])
  if (items === undefined) return <main className="screen"><p className="muted">Loading…</p></main>
  if (!items || !unit || !step) return <Navigate to={`/unit/${n}`} replace />
  return <Practice sessionKey={lessonKey(unit.n, step)} items={items} mode="lesson" unit={unit.n} step={step} closeTo={`/unit/${unit.n}/${step}`} />
}

function DialogueView({ d }: { d: Dialogue }) {
  const { playing } = useAudio()
  const ids = d.lines.map(l => l.id)
  const isPlaying = ids.includes(playing ?? '')
  return (
    <section className="card">
      <h2>{d.title}</h2>
      <p className="muted">{d.en}</p>
      <button className="btn btn-primary btn-sm my-2" onClick={() => (isPlaying ? audio.stop() : audio.playAll(ids))}>
        {isPlaying ? '■ Stop' : '▶ Play whole dialogue'}
      </button>
      <div className="chat">
        {d.lines.map((l, i) => {
          const sp = d.speakers[l.speaker]
          const on = playing === l.id
          // Name only when the speaker changes, like a group chat.
          const showName = !sp.me && d.lines[i - 1]?.speaker !== l.speaker
          return (
            <div key={l.id} className={'chat-line ' + (sp.me ? 'me' : 'them')}>
              {showName && <span className="chat-name">{sp.name}</span>}
              <button className={'bubble tap' + (on ? ' playing' : '')} onClick={() => audio.play(l.id)} aria-label={`${sp.name}: ${l.pt}. Tap to hear it.`}>
                <span className="bubble-pt">{l.pt}</span>
                <span className="bubble-en">{l.en}</span>
                <span className="bubble-play" aria-hidden>{on ? '🔊' : '▶'}</span>
              </button>
            </div>
          )
        })}
      </div>
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
  return <>{unit.grammar.topics.map((t, i) => <GrammarTopicView key={t.id} unit={unit.n} topic={t} index={i} />)}</>
}
