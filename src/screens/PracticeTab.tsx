import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { a1Content } from '../content'
import type { Exercise, Part } from '../content/types'
import { GrammarTopicView } from '../components/Grammar'
import { SlowToggle } from '../components/AudioRow'
import Practice from './Practice'
import { PARTS, generateTest, listeningDrill, questionPool, rng, speakingDrill } from '../test'
import { verbs } from '../verbs'
import { lookPairs, pairOpen } from '../lookalikes'
import { isDone, learnedUnits, openAnyway, textOpen, useDone, verbLearned } from '../learned'
import { useDue } from '../review'
import { readingTexts } from '../content/reading'
import { useToast } from '../toast'

const TEST_KEY = 'test'
const LENGTHS = [10, 20, 30]

/** What opens each part, for the toast when it's still empty. */
const OPENS: Record<Part, string> = {
  vocab: 'Finish a unit’s Key phrases or Vocabulary step to get these questions.',
  listening: 'Finish a unit’s Dialogue or Key phrases step to get listening questions.',
  grammar: 'Finish a unit’s Grammar step to get grammar questions.',
  sentences: 'Finish a unit’s Exercises step to get these questions.',
  verbs: 'Finish Unit 0’s Key phrases to get your first verbs.',
  reading: 'Finish Unit 1 to open the first reading texts.',
  speaking: 'Finish a unit’s Speaking drill to get speaking questions.',
}

const UNITS = Object.values(a1Content).sort((a, b) => a.n - b.n)

const unitList = (ns: number[]) => ns.length === 1 ? `Unit ${ns[0]}` : `Units ${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}`

// ---------- /practice ----------
export default function PracticeHub() {
  const toast = useToast()
  const navigate = useNavigate()
  const due = useDue()
  const openTest = useLiveQuery(() => db.sessions.get(TEST_KEY))
  const readCount = useLiveQuery(() => db.progress.where('unit').equals(-1).count())
  const units = UNITS
  const done = useDone()

  // Practice only uses what you've finished: the steps you've done, the verbs and texts they open.
  const learned = useMemo(() => (done ? learnedUnits(UNITS, done) : []), [done])
  const extras = useMemo(() => ({ verbs: done ? verbs.filter(v => verbLearned(v, done)) : [], texts: done ? readingTexts.filter(t => textOpen(t, done)) : [] }), [done])

  const [off, setOff] = useState<number[]>([]) // learned units you've switched off for the test
  const picked = useMemo(() => learned.map(u => u.n).filter(n => !off.includes(n)), [learned, off])
  const pool = useMemo(() => questionPool(learned.filter(u => picked.includes(u.n)), rng(1), extras), [learned, extras, picked])
  const speakCount = useMemo(() => speakingDrill(learned, 999, 1).length, [learned])
  const listenCount = useMemo(() => questionPool(learned, rng(1)).listening.length, [learned])
  // Speaking needs the mic, so it's opt-in for tests.
  const [parts, setParts] = useState<Part[]>(PARTS.map(p => p.id).filter(p => p !== 'speaking'))
  const [length, setLength] = useState(20)
  const [setup, setSetup] = useState(false) // show the new-test form while a test is unfinished

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const start = async () => {
    if (!learned.length) return toast('Finish a step in Unit 0 first. Tests use what you’ve learned.')
    if (!picked.length) return toast('Pick at least one unit.')
    const usable = parts.filter(p => pool[p].length)
    if (!usable.length) return toast(parts.length ? OPENS[parts[0]] : 'Pick at least one part.')
    try {
      const items = generateTest(learned.filter(u => picked.includes(u.n)), usable, length, Date.now(), extras)
      if (!items.length) return toast('No questions for this selection yet.')
      await db.sessions.put({ key: TEST_KEY, queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString(), items })
      if (items.length < length) toast(`Only ${items.length} questions available for this selection.`)
      navigate('/practice/test')
    } catch (e) {
      toast(`Couldn't create the test: ${(e as Error).message}`, 'error')
    }
  }

  const startDrill = async (key: string, items: Exercise[], label: string) => {
    try {
      await db.sessions.put({ key, queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString(), items })
      navigate(`/drill/run/${key}`)
    } catch (e) { toast(`Couldn't start ${label}: ${(e as Error).message}`, 'error') }
  }

  return (
    <main className="screen">
      <h1>Practice</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 8 }}>
        {learned.length ? `Built from what you've finished in ${unitList(learned.map(u => u.n))}. Finish more steps to open more.` : 'Practice uses what you’ve learned. Finish the first step in Unit 0 to start.'}
      </p>

      <p className="section-label">Every day</p>
      {due && due.count > 0 ? (
        <Link className="card tap" to="/review" state={{ from: '/practice' }}>
          <span className="chev">›</span>
          <h2>🗂️ Daily review</h2>
          <p className="muted">{due.count} {due.count === 1 ? 'card' : 'cards'} due now · about {Math.max(1, Math.round(due.count / 4))} min</p>
          <p className="small muted" style={{ marginTop: 6 }}>Flashcards of the words you've learned, each shown again just before you'd forget it.</p>
        </Link>
      ) : (
        <button className="card tap" onClick={() => toast(due?.total
          ? 'All caught up. Words come back when it’s time to repeat them.'
          : 'Words enter your review when you finish a unit’s Key phrases or Vocabulary step.')}>
          <span className="chev">›</span>
          <h2>🗂️ Daily review</h2>
          <p className="muted">{due?.total ? 'All caught up ✓' : 'No words yet'}</p>
          <p className="small muted" style={{ marginTop: 6 }}>Flashcards of the words you've learned, each shown again just before you'd forget it.</p>
        </button>
      )}

      <p className="section-label">Practise a skill</p>
      <Link className="card tap" to="/talk">
        <span className="chev">›</span>
        <h2>🗣️ Conversation</h2>
        <p className="muted">Role-play the café, the market, the delivery driver… with an AI partner (Gemini)</p>
      </Link>
      <button className={'card tap' + (speakCount ? '' : ' soft-locked')} onClick={() => speakCount ? startDrill('speaking', speakingDrill(learned, 10), 'speaking practice') : toast(OPENS.speaking)}>
        <span className="chev">›</span>
        <h2>🎤 Speaking</h2>
        <p className="muted">{speakCount ? `10 things to say out loud, from ${speakCount} prompts and replies you've practised` : '🔒 Opens when you finish a unit’s Speaking drill'}</p>
      </button>
      <button className={'card tap' + (listenCount ? '' : ' soft-locked')} onClick={() => listenCount ? startDrill('listening', listeningDrill(learned, 15), 'listening practice') : toast(OPENS.listening)}>
        <span className="chev">›</span>
        <h2>🎧 Listening</h2>
        <p className="muted">{listenCount ? '15 questions: meaning, dictation, what you heard, missing word, whole conversations' : '🔒 Opens when you finish a unit’s Dialogue or Key phrases'}</p>
      </button>
      <Link className="card tap" to="/reading">
        <span className="chev">›</span>
        <h2>📰 Reading</h2>
        <p className="muted">{extras.texts.length} of {readingTexts.length} texts open, about Peniche, food and festivals, or any topic you like{readCount ? ` · ${readCount} done` : ''}</p>
      </Link>
      <Link className="card tap" to="/practice/verbs">
        <span className="chev">›</span>
        <h2>🔤 Verb trainer</h2>
        <p className="muted">{extras.verbs.length ? `${extras.verbs.length} of ${verbs.length} verbs from your units: tables with audio, drills, weak verbs first` : `${verbs.length} common verbs; they open as you finish each unit’s Key phrases`}</p>
      </Link>
      <Link className="card tap" to="/practice/lookalikes">
        <span className="chev">›</span>
        <h2>🔍 Look-alikes</h2>
        <p className="muted">{(() => { const n = done ? lookPairs.filter(p => pairOpen(p, done)).length : 0; return n ? `${n} of ${lookPairs.length} pairs like é / e and está / esta: hear the difference, use the right one` : `${lookPairs.length} pairs like é / e and avó / avô; they open as you finish each unit’s Key phrases` })()}</p>
      </Link>
      <Link className="card tap" to="/practice/grammar">
        <span className="chev">›</span>
        <h2>📖 Grammar reference</h2>
        <p className="muted">{(() => { const n = units.filter(u => done && isDone(done, u.n, 'grammar')).reduce((a, u) => a + u.grammar.topics.length, 0); return n ? `${n} topics you've learned, each with its own practice` : 'Topics open as you finish each unit’s Grammar step' })()}</p>
      </Link>

      <p className="section-label">Check yourself</p>
      {/* A form with many controls: flat on the page so it gets the full width (cards are for single-tap tiles). */}
      <section className="flat-section" style={{ marginTop: 8 }}>
        <h2>📝 Mixed test</h2>
        <p className="muted">A one-off quiz across units and skills. You get a score per skill, so you see where you're weak. Take one whenever you like.</p>

        {openTest && (
          <div className="resume-banner">
            <p><b>You have an unfinished test</b><span className="muted"> · {openTest.total - new Set(openTest.queue).size} of {openTest.total} answered</span></p>
            <div className="row-btns">
              <Link className="btn btn-primary" to="/practice/test" style={{ textDecoration: 'none' }}>Continue</Link>
              <button className="btn btn-tonal" onClick={async () => { await db.sessions.delete(TEST_KEY); setSetup(false); toast('Test discarded.') }}>Discard</button>
            </div>
          </div>
        )}

        {openTest && !setup ? (
          <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setSetup(true)}>Set up a new test instead</button>
        ) : (
          <>
            <p className="section-label">Units</p>
            <div className="filters wrap">
              {units.map(u => {
                const open = learned.some(l => l.n === u.n)
                return (
                  <button key={u.n} className={'btn btn-sm rounded-full ' + (!open ? 'btn-soft chip-locked' : picked.includes(u.n) ? 'btn-primary' : 'btn-soft')}
                    onClick={() => open ? setOff(cur => toggle(cur, u.n)) : toast(`Unit ${u.n} joins your tests once you finish one of its steps.`)}>
                    {open ? '' : '🔒 '}Unit {u.n}
                  </button>
                )
              })}
            </div>

            <p className="section-label">Parts</p>
            <div className="filters wrap">
              {PARTS.map(p => {
                const open = pool[p.id].length > 0
                return (
                  <button key={p.id} className={'btn btn-sm rounded-full ' + (!open ? 'btn-soft chip-locked' : parts.includes(p.id) ? 'btn-primary' : 'btn-soft')}
                    onClick={() => open ? setParts(cur => toggle(cur, p.id)) : toast(OPENS[p.id])}>
                    {open ? '' : '🔒 '}{p.title}
                  </button>
                )
              })}
            </div>

            <p className="section-label">Length</p>
            <div className="join w-full">
              {LENGTHS.map(n => (
                <button key={n} className={'btn join-item flex-1 ' + (length === n ? 'btn-primary' : '')} onClick={() => setLength(n)}>{n}</button>
              ))}
            </div>

            <button className="btn btn-primary btn-block btn-big" style={{ marginTop: 16, textAlign: 'center' }} onClick={start}>
              {openTest ? 'Start new test' : 'Start test'}
              {openTest && <small>Replaces the unfinished one</small>}
            </button>
          </>
        )}
      </section>
    </main>
  )
}

// ---------- /practice/test ----------
export function TestRunner() {
  // Load the questions once: the saved test is deleted when it finishes, but the results still need them.
  const [items, setItems] = useState<Exercise[] | null | undefined>(undefined)
  useEffect(() => { db.sessions.get(TEST_KEY).then(s => setItems(s?.items ?? null)).catch(() => setItems(null)) }, [])
  if (items === undefined) return <main className="screen"><p className="muted">Loading…</p></main>
  if (!items) return <Navigate to="/practice" replace />
  return <Practice sessionKey={TEST_KEY} items={items} mode="test" closeTo="/practice" />
}

// ---------- /practice/grammar ----------
export function GrammarReference() {
  const units = UNITS
  const navigate = useNavigate()
  const done = useDone()
  return (
    <main className="screen">
      <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice">‹ Practice</Link>
      <h1>Grammar</h1>
      <p className="muted" style={{ marginBottom: 8 }}>Each topic opens when you finish its unit's Grammar step.</p>
      {units.map(u => {
        const open = !done || isDone(done, u.n, 'grammar')
        return (
          <section key={u.id}>
            <p className="section-label">Unit {u.n} · {u.title}</p>
            {u.grammar.topics.map(t => open ? (
              <Link key={t.id} className="card tap" to={`/grammar/${u.n}/${t.id}`}>
                <span className="chev">›</span>
                <h2>{t.title}</h2>
                <p className="muted">{t.exercises.length} practice questions</p>
              </Link>
            ) : (
              <button key={t.id} className="card tap soft-locked" onClick={() => openAnyway(navigate, `This topic is part of Unit ${u.n}. It opens when you finish that unit's Grammar step.`, `/grammar/${u.n}/${t.id}`)}>
                <span className="chev">›</span>
                <h2>{t.title}</h2>
                <p className="muted">🔒 Opens with Unit {u.n} · Grammar</p>
              </button>
            ))}
          </section>
        )
      })}
    </main>
  )
}

// ---------- /grammar/:n/:topic ----------
export function GrammarTopicScreen() {
  const { n, topic } = useParams()
  const unit = a1Content[Number(n)]
  const t = unit?.grammar.topics.find(x => x.id === topic)
  if (!unit || !t) return <Navigate to="/practice/grammar" replace />
  return (
    <main className="screen">
      <div className="step-head">
        <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice/grammar">‹ Grammar</Link>
        <SlowToggle />
      </div>
      <p className="section-label">Unit {unit.n} · {unit.title}</p>
      <GrammarTopicView unit={unit.n} topic={t} />
    </main>
  )
}

// ---------- /drill/grammar/:n/:topic ----------
export function GrammarDrill() {
  const { n, topic } = useParams()
  const unit = a1Content[Number(n)]
  const t = unit?.grammar.topics.find(x => x.id === topic)
  if (!unit || !t) return <Navigate to="/practice/grammar" replace />
  return <Practice sessionKey={`drill:${t.id}`} items={t.exercises} mode="drill" closeTo={`/grammar/${unit.n}/${t.id}`} />
}
