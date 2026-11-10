import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { a1Content } from '../content'
import { unitSteps } from '../units'
import { audio, useAudio } from '../audio'
import { AudioRow, SlowToggle } from '../components/AudioRow'
import type { Dialogue, Unit } from '../content/types'
import { LESSON_LENGTH, lessonQuestions, speakingQuestions } from '../test'
import { GrammarTopicView } from '../components/Grammar'
import Practice from './Practice'
import { grammarLessonRound, grammarLessonSize, stepRound } from '../grammarPool'
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
    return <Practice key={step} sessionKey={`${unit.n}:${step}`} nextRound={() => stepRound(unit, step)} mode={step} unit={unit.n} closeTo={`/unit/${unit.n}`} />
  }

  const i = unitSteps.indexOf(meta)
  const next = unitSteps.slice(i + 1).find(s => s.ready)
  const done = !!progress?.[meta.slug]?.done
  const best = progress?.[meta.slug]?.bestScore
  const count = meta.slug === 'grammar' ? grammarLessonSize(unit)
    : meta.slug === 'speaking' ? speakingQuestions(unit).length
    : meta.slug === 'phrases' ? unit.phrases.length * 2 : meta.slug === 'vocab' ? unit.vocab.length * 2 : LESSON_LENGTH

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
      {step === 'speaking' && <SpeakingView unit={unit} />}

      <section className="card practise-card" id="practise">
        <h2>{done ? 'Practise again' : 'Practise it now'}</h2>
        <p className="muted">
          {meta.slug === 'speaking' ? `${count} things to say out loud: ${unit.speaking.length} prompts, then a role-play of the dialogues.` : `${count} quick questions on this lesson.`}{!done && ` Get ${Math.round(PASS_MARK * 100)}% and it's marked as done.`}
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
  if (!unit || !step) return <Navigate to={`/unit/${n}`} replace />
  // Resumes a saved round; a new one (and every "Practise again") gets new questions and a new order.
  const round = async () => step === 'grammar' ? grammarLessonRound(unit) : lessonQuestions(unit, step)
  return <Practice key={step} sessionKey={lessonKey(unit.n, step)} nextRound={round} mode="lesson" unit={unit.n} step={step} closeTo={`/unit/${unit.n}/${step}`} />
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
  // After a topic's practice you come back here, at the next topic (or at the step's own practice after the last one).
  const topics = unit.grammar.topics
  const [params] = useSearchParams()
  const at = params.get('at')
  useEffect(() => {
    if (!at) return
    // After the app's scroll-to-top on navigation.
    const f = requestAnimationFrame(() => document.getElementById(at)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(f)
  }, [at])
  return <>{topics.map((t, i) => <GrammarTopicView key={t.id} unit={unit.n} topic={t} index={i} inLesson />)}</>
}

function SpeakingView({ unit }: { unit: Unit }) {
  return (
    <>
      <section className="card tip">
        <h3>How it works</h3>
        <p>Tap 🎤 and speak. Most words matching counts as right. In the role-play, you reply.</p>
      </section>
      {unit.dialogues.map(d => <Shadowing key={d.title} d={d} />)}
    </>
  )
}

/** Shadowing: hear a line, record yourself, then hear both back to back. Recordings stay in memory only. */
function Shadowing({ d }: { d: Dialogue }) {
  const toast = useToast()
  const { playing } = useAudio()
  const [recording, setRecording] = useState<string | null>(null)
  const [takes, setTakes] = useState<Record<string, string>>({})
  const rec = useRef<{ r: MediaRecorder; stream: MediaStream; timer: number } | null>(null)
  const urls = useRef<string[]>([])
  useEffect(() => () => {
    rec.current?.stream.getTracks().forEach(t => t.stop())
    urls.current.forEach(u => URL.revokeObjectURL(u))
  }, [])

  const stop = () => { if (rec.current) { clearTimeout(rec.current.timer); rec.current.r.stop() } }
  const record = async (id: string) => {
    if (recording) return stop()
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast("Recording isn't available in this browser.")
    audio.stop()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      const chunks: Blob[] = []
      r.ondataavailable = e => chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        rec.current = null
        setRecording(null)
        const url = URL.createObjectURL(new Blob(chunks, { type: r.mimeType }))
        urls.current.push(url)
        setTakes(t => ({ ...t, [id]: url }))
        audio.playAll([id, url]) // compare straight away: Raquel, then you
      }
      r.start()
      rec.current = { r, stream, timer: window.setTimeout(stop, 10_000) }
      setRecording(id)
    } catch (e) {
      const name = (e as Error).name
      toast(name === 'NotAllowedError' ? 'The microphone is blocked. Allow it when your iPhone asks.' : `Couldn't record: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <section className="card">
      <h2>🔁 Shadowing: {d.title}</h2>
      <p className="muted">Listen, record yourself saying the line, then hear both back to back. Copy the rhythm, not just the words.</p>
      {d.lines.map(l => {
        const take = takes[l.id]
        const on = playing === l.id || (!!take && playing === take)
        return (
          <div key={l.id} className={'shadow-row' + (on ? ' playing' : '')}>
            <div className="shadow-text">
              <span className="pt" lang="pt-PT">{l.pt}</span>
              <span className="en">{l.en}</span>
            </div>
            <div className="shadow-btns">
              <button className="btn btn-circle btn-sm btn-tonal" onClick={() => audio.play(l.id)} aria-label="Hear the line">{playing === l.id ? '🔊' : '▶'}</button>
              <button className={'btn btn-circle btn-sm ' + (recording === l.id ? 'btn-miss' : 'btn-tonal')} onClick={() => (recording && recording !== l.id ? toast('Finish the other recording first.') : record(l.id))} aria-label={recording === l.id ? 'Stop recording' : 'Record yourself'}>
                {recording === l.id ? '■' : '🎙'}
              </button>
              <button className="btn btn-circle btn-sm btn-tonal" onClick={() => (take ? audio.playAll([l.id, take]) : toast('Record yourself first (🎙), then compare.'))} aria-label="Compare: the line, then you">⇆</button>
            </div>
          </div>
        )
      })}
    </section>
  )
}
