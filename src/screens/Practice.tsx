import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Exercise, Unit } from '../content/types'
import type { PracticeSession } from '../db'
import { ExerciseView, type Answer } from '../components/Exercises'
import { audio } from '../audio'
import { PASS_MARK, clearSession, getSession, logAttempt, markStepDone, newSessionKey, saveSession } from '../progress'
import { unitSteps } from '../units'
import { useToast } from '../toast'

type Mode = 'exercises' | 'check'

/**
 * Runs a list of exercises. Position is saved after every answer, so closing the app
 * returns you to the same exercise. In "exercises", wrong answers come back at the end;
 * the unit check goes through once and is scored.
 */
export default function Practice({ unit, mode }: { unit: Unit; mode: Mode }) {
  const toast = useToast()
  const items = mode === 'exercises' ? unit.exercises : unit.check
  const byId = Object.fromEntries(items.map(x => [x.id, x])) as Record<string, Exercise>

  const [session, setSession] = useState<PracticeSession | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [finished, setFinished] = useState<{ score: number; missed: Exercise[] } | null>(null)

  const start = async (fresh = false) => {
    let s = fresh ? undefined : await getSession(unit.n, mode)
    // Start over if there's no session or the unit's exercises changed since.
    if (!s || !s.queue.length || s.queue.some(id => !byId[id])) {
      s = { key: newSessionKey(unit.n, mode), queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString() }
      await saveSession(s)
    }
    setAnswer(null)
    setFinished(null)
    setSession(s)
  }

  useEffect(() => {
    start().catch(e => toast(`Couldn't load your progress: ${e.message}`, 'error'))
    return () => audio.stop()
  }, [unit.n, mode]) // eslint-disable-line react-hooks/exhaustive-deps -- run once per unit/mode

  if (finished) return <Results unit={unit} mode={mode} {...finished} onRetry={() => start(true)} />
  if (!session) return <main className="screen"><p className="muted">Loading…</p></main>

  const current = byId[session.queue[0]]
  const remaining = new Set(session.queue).size
  const progress = (session.total - remaining) / session.total

  const onAnswer = (a: Answer) => {
    setAnswer(a)
    logAttempt(unit.n, mode, current.id, a.result.ok, a.given).catch(() => {})
    // Replay the Portuguese for listening exercises so you hear it again with the answer.
    if (current.type === 'listen-choose') audio.play(current.id)
  }

  const next = async () => {
    try {
      const ok = answer!.result.ok
      const firstTry = current.id in session.firstTry ? session.firstTry : { ...session.firstTry, [current.id]: ok }
      const queue = session.queue.slice(1)
      if (!ok && mode === 'exercises') queue.push(current.id)
      const s = { ...session, queue, firstTry }

      if (!queue.length) {
        const right = Object.values(firstTry).filter(Boolean).length
        const score = right / session.total
        await markStepDone(unit.n, mode, score)
        await clearSession(unit.n, mode)
        setFinished({ score, missed: items.filter(x => firstTry[x.id] === false) })
        return
      }
      await saveSession(s)
      setSession(s)
      setAnswer(null)
    } catch (e) {
      toast(`Couldn't save your progress: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <main className="screen practice">
      <div className="practice-head">
        <Link className="close tap" to={`/unit/${unit.n}`} aria-label="Close (progress is saved)">✕</Link>
        <div className="progress grow"><div style={{ width: `${progress * 100}%` }} /></div>
        <span className="muted count">{session.total - remaining + 1}/{session.total}</span>
      </div>

      <ExerciseView key={current.id + ':' + session.queue.length} ex={current} locked={!!answer} onAnswer={onAnswer} />

      {answer && (
        <div className={'feedback ' + (answer.result.ok ? 'ok' : 'bad')} role="status">
          <b>{answer.result.ok ? 'Correct! ✓' : 'Not quite'}</b>
          {!answer.result.ok && <p>Correct answer: <b>{answer.result.expected}</b></p>}
          {answer.result.ok && answer.result.note && <p>{answer.result.note}</p>}
          {!answer.result.ok && mode === 'exercises' && <p className="small">This one comes back at the end.</p>}
          <button className="btn" onClick={next}>Continue</button>
        </div>
      )}
    </main>
  )
}

function Results({ unit, mode, score, missed, onRetry }: { unit: Unit; mode: Mode; score: number; missed: Exercise[]; onRetry: () => void }) {
  const navigate = useNavigate()
  const pct = Math.round(score * 100)
  const passed = score >= PASS_MARK
  const i = unitSteps.findIndex(s => s.slug === mode)
  const nextReady = unitSteps.slice(i + 1).find(s => s.ready)

  return (
    <main className="screen">
      <h1>{mode === 'check' ? (passed ? 'Passed! 🎉' : 'Not yet') : 'Exercises done ✓'}</h1>
      <div className="card">
        <p className="score">{pct}%</p>
        <p className="muted">
          {mode === 'check'
            ? passed
              ? `Unit ${unit.n} is complete.`
              : `You need ${Math.round(PASS_MARK * 100)}% to pass. Review the answers below and try again.`
            : 'Right on the first try.'}
        </p>
      </div>
      {missed.length > 0 && (
        <div className="card">
          <h2>To review</h2>
          {missed.map(x => <p key={x.id} className="missed">{describe(x)}</p>)}
        </div>
      )}
      {mode === 'check' && !passed && <button className="btn" onClick={onRetry}>Try the check again</button>}
      {mode === 'exercises' && nextReady && (
        <button className="btn" onClick={() => navigate(`/unit/${unit.n}/${nextReady.slug}`)}>Next: {nextReady.title} ›</button>
      )}
      {mode === 'exercises' && <button className="btn secondary-btn" onClick={onRetry}>Practise again</button>}
      <Link className="btn secondary-btn" to={`/unit/${unit.n}`} style={{ textDecoration: 'none' }}>Back to Unit {unit.n}</Link>
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
  }
}
