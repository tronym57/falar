import { useEffect, useState, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { Link, useNavigate } from 'react-router-dom'
import type { Exercise } from '../content/types'
import { db, type PracticeSession } from '../db'
import { ExerciseView, type Answer } from '../components/Exercises'
import { audio } from '../audio'
import { PASS_MARK, logAttempt, markStepDone } from '../progress'
import { unitSteps } from '../units'
import { PARTS, scoreByPart } from '../test'
import { useToast } from '../toast'

/**
 * exercises: a unit's exercise step (wrong answers come back at the end)
 * check:     the unit check (one pass, 80% to pass)
 * drill:     practise a grammar topic (wrong answers come back)
 * test:      a mixed test from the Practice tab (one pass, score per part)
 * lesson:    practise a reading step right after it; 80% marks the step done
 */
export type Mode = 'exercises' | 'check' | 'drill' | 'test' | 'lesson'

type Props = {
  sessionKey: string
  items: Exercise[]
  mode: Mode
  unit?: number // for exercises/check/lesson: marks the step done
  step?: string // for lesson: the reading step being practised
  closeTo: string
}

/**
 * Runs a list of exercises. Position is saved after every answer, so closing the app
 * returns you to the same exercise.
 */
export default function Practice({ sessionKey, items, mode, unit, step, closeTo }: Props) {
  const toast = useToast()
  const byId = Object.fromEntries(items.map(x => [x.id, x])) as Record<string, Exercise>
  const requeue = mode === 'exercises' || mode === 'drill' || mode === 'lesson'

  const [session, setSession] = useState<PracticeSession | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [finished, setFinished] = useState<{ score: number; firstTry: Record<string, boolean> } | null>(null)

  const start = async (fresh = false) => {
    let s = fresh ? undefined : await db.sessions.get(sessionKey)
    // Start over if there's no session or the exercises changed since.
    if (!s || !s.queue.length || s.queue.some(id => !byId[id])) {
      s = { key: sessionKey, queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString(), items }
      await db.sessions.put(s)
    }
    setAnswer(null)
    setFinished(null)
    setSession(s)
  }

  useEffect(() => {
    start().catch(e => toast(`Couldn't load your progress: ${e.message}`, 'error'))
    return () => audio.stop()
  }, [sessionKey]) // eslint-disable-line react-hooks/exhaustive-deps -- once per session

  if (finished) {
    return <Results mode={mode} unit={unit} step={step} items={items} closeTo={closeTo} {...finished} onRetry={() => start(true)} />
  }
  if (!session) return <main className="screen"><p className="muted">Loading…</p></main>

  const current = byId[session.queue[0]]
  const remaining = new Set(session.queue).size
  const progress = (session.total - remaining) / session.total

  const onAnswer = (a: Answer) => {
    setAnswer(a)
    logAttempt(unit ?? -1, mode, current.id, a.result.ok, a.given).catch(() => {})
    // Replay the Portuguese for listening exercises so you hear it again with the answer.
    if (current.type === 'listen-choose') audio.play(current.audio ?? current.id)
    if (current.type === 'dictation' || current.type === 'listen-pick' || current.type === 'listen-gap') audio.play(current.audio)
  }

  const next = async () => {
    try {
      const ok = answer!.result.ok
      const firstTry = current.id in session.firstTry ? session.firstTry : { ...session.firstTry, [current.id]: ok }
      const queue = session.queue.slice(1)
      if (!ok && requeue) queue.push(current.id)
      const s = { ...session, queue, firstTry }

      if (!queue.length) {
        const score = Object.values(firstTry).filter(Boolean).length / session.total
        if (unit !== undefined && (mode === 'exercises' || mode === 'check')) await markStepDone(unit, mode, score)
        if (unit !== undefined && mode === 'lesson' && step && score >= PASS_MARK) await markStepDone(unit, step, score)
        await db.sessions.delete(sessionKey)
        setFinished({ score, firstTry })
        return
      }
      await db.sessions.put(s)
      setSession(s)
      setAnswer(null)
    } catch (e) {
      toast(`Couldn't save your progress: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <main className="screen practice">
      <div className="practice-head">
        <Link className="btn btn-ghost btn-circle btn-sm text-xl" to={closeTo} aria-label="Close (progress is saved)">✕</Link>
        <div className="run-bar"><motion.div className="run-fill" initial={false} animate={{ width: `${progress * 100}%` }} transition={{ type: 'spring', stiffness: 180, damping: 26 }} /></div>
        <span className="muted count">{Math.min(Object.keys(session.firstTry).length + 1, session.total)}/{session.total}</span>
      </div>

      {/* The next question slides in from the right. */}
      <motion.div key={current.id + ':' + session.queue.length} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
        <ExerciseView ex={current} locked={!!answer} onAnswer={onAnswer} />
      </motion.div>

      {answer && (
        <motion.div className={'feedback ' + (answer.result.ok ? 'ok' : 'bad')} role="status" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
          <b>{answer.result.ok ? 'Correct! ✓' : 'Not quite'}</b>
          {!answer.result.ok && <p>Correct answer: <b>{answer.result.expected}</b></p>}
          {answer.result.ok && answer.result.note && <p>{answer.result.note}</p>}
          {!answer.result.ok && requeue && <p className="small">This one comes back at the end.</p>}
          <button className={'btn btn-block btn-big ' + (answer.result.ok ? 'btn-success' : 'btn-miss')} onClick={next}>Continue</button>
        </motion.div>
      )}
    </main>
  )
}

type ResultsProps = { mode: Mode; unit?: number; step?: string; items: Exercise[]; closeTo: string; score: number; firstTry: Record<string, boolean>; onRetry: () => void }

function Results({ mode, unit, step, items, closeTo, score, firstTry, onRetry }: ResultsProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const pct = Math.round(score * 100)
  const passed = score >= PASS_MARK
  const missed = items.filter(x => firstTry[x.id] === false)
  const i = unitSteps.findIndex(s => s.slug === (mode === 'lesson' ? step : mode))
  const nextReady = mode === 'exercises' || mode === 'lesson' ? unitSteps.slice(i + 1).find(s => s.ready) : undefined
  const stepTitle = unitSteps[i]?.title
  const byPart = mode === 'test' ? scoreByPart(items, firstTry) : null

  const title = { exercises: 'Exercises done ✓', check: passed ? 'Passed! 🎉' : 'Not yet', drill: 'Practice done ✓', test: 'Test done ✓', lesson: passed ? 'Lesson complete ✓' : 'Almost there' }[mode]

  return (
    <main className="screen">
      <h1>{title}</h1>
      <div className="card text-center">
        <div className="radial-progress text-primary score-ring mb-3 mx-auto" style={{ '--value': pct } as CSSProperties} role="progressbar" aria-valuenow={pct}>{pct}%</div>
        <p className="muted">
          {mode === 'check'
            ? passed ? `Unit ${unit} is complete.` : `You need ${Math.round(PASS_MARK * 100)}% to pass. Review the answers below and try again.`
            : mode === 'lesson'
              ? passed ? `${stepTitle} is marked as done.` : `Get ${Math.round(PASS_MARK * 100)}% to complete ${stepTitle}, or mark it as done yourself.`
              : 'Right on the first try.'}
        </p>
      </div>

      {byPart && (
        <div className="card">
          <h2>By part</h2>
          {PARTS.filter(p => byPart[p.id]).map(p => {
            const r = byPart[p.id]!
            const v = Math.round((r.right / r.total) * 100)
            return (
              <div key={p.id} className="part-row">
                <div className="row"><span>{p.title}</span><span className={v < 70 ? 'text-miss' : 'muted'}>{r.right}/{r.total} · {v}%</span></div>
                <progress className={'progress ' + (v < 70 ? 'progress-miss' : 'progress-primary')} value={v} max={100} />
              </div>
            )
          })}
        </div>
      )}

      {missed.length > 0 && (
        <div className="card">
          <h2>To review</h2>
          {missed.map(x => <p key={x.id} className="missed">{describe(x)}</p>)}
        </div>
      )}

      {mode === 'check' && !passed && <button className="btn btn-primary btn-block btn-big" onClick={onRetry}>Try the check again</button>}
      {mode === 'lesson' && !passed && (
        <>
          <button className="btn btn-primary btn-block btn-big" onClick={onRetry}>Practise again</button>
          <button className="btn btn-tonal btn-block btn-big" onClick={async () => {
            try {
              await markStepDone(unit!, step!, score)
              toast(`${stepTitle} marked as done ✓`)
              navigate(nextReady ? `/unit/${unit}/${nextReady.slug}` : `/unit/${unit}`)
            } catch (e) { toast(`Couldn't save: ${(e as Error).message}`, 'error') }
          }}>Mark as done anyway</button>
        </>
      )}
      {nextReady && unit !== undefined && (mode !== 'lesson' || passed) && (
        <button className="btn btn-primary btn-block btn-big" onClick={() => navigate(`/unit/${unit}/${nextReady.slug}`)}>Next: {nextReady.title} ›</button>
      )}
      {(mode === 'exercises' || mode === 'drill' || (mode === 'lesson' && passed)) && <button className="btn btn-tonal btn-block btn-big" onClick={onRetry}>Practise again</button>}
      {mode === 'test' && <button className="btn btn-primary btn-block btn-big" onClick={() => navigate('/practice')}>New test</button>}
      <Link className="btn btn-tonal btn-block btn-big" to={closeTo} style={{ textDecoration: 'none' }}>Done</Link>
    </main>
  )
}

/** One-line summary of an exercise and its answer, for the review list. */
function describe(x: Exercise) {
  switch (x.type) {
    case 'listen-choose': return `${x.pt} → ${x.options[x.answer]}`
    case 'choose': return `${x.prompt} → ${x.options[x.answer]}`
    case 'gap-fill': return `${x.pt.replace('___', x.answers[0])} (${x.en})`
    case 'sentence-builder': return `${x.en} → ${x.answer}`
    case 'translate': return `${x.en} → ${x.answers[0]}`
    case 'conjugation': return `${x.verb}, ${x.person} → ${x.answers[0]}`
    case 'verb-table': return `${x.verb}: ${x.answers.join(', ')}`
    case 'dictation': return `🎧 ${x.answers[0]}`
    case 'listen-pick': return `🎧 ${x.options[x.answer]}`
    case 'listen-gap': return `🎧 ${x.pt.replace('___', x.answers[0])}`
    case 'listen-dialogue': return `${x.title}: ${x.question} → ${x.options[x.answer]}`
  }
}
