import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { a1Content } from '../content'
import type { Exercise, Part } from '../content/types'
import { GrammarTopicView } from '../components/Grammar'
import { SlowToggle } from '../components/AudioRow'
import Practice from './Practice'
import { PARTS, generateTest, listeningDrill } from '../test'
import { useDue } from '../review'
import { readingTexts } from '../content/reading'
import { useToast } from '../toast'

const TEST_KEY = 'test'
const LENGTHS = [10, 20, 30]

// ---------- /practice ----------
export default function PracticeHub() {
  const toast = useToast()
  const navigate = useNavigate()
  const due = useDue()
  const openTest = useLiveQuery(() => db.sessions.get(TEST_KEY))
  const readCount = useLiveQuery(() => db.progress.where('unit').equals(-1).count())
  const units = Object.values(a1Content).sort((a, b) => a.n - b.n)

  const [picked, setPicked] = useState<number[]>(() => units.map(u => u.n))
  const [parts, setParts] = useState<Part[]>(PARTS.map(p => p.id))
  const [length, setLength] = useState(20)

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const start = async () => {
    if (!picked.length) return toast('Pick at least one unit.')
    if (!parts.length) return toast('Pick at least one part.')
    try {
      const items = generateTest(units.filter(u => picked.includes(u.n)), parts, length)
      if (!items.length) return toast('No questions for this selection yet.')
      await db.sessions.put({ key: TEST_KEY, queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString(), items })
      if (items.length < length) toast(`Only ${items.length} questions available for this selection.`)
      navigate('/practice/test')
    } catch (e) {
      toast(`Couldn't create the test: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <main className="screen">
      <h1>Practice</h1>

      {due && due.count > 0 ? (
        <Link className="card tap" to="/review">
          <span className="chev">›</span>
          <h2>🗂️ Daily review</h2>
          <p className="muted">{due.count} {due.count === 1 ? 'card' : 'cards'} due now</p>
        </Link>
      ) : (
        <button className="card tap" onClick={() => toast(due?.total
          ? 'All caught up. Words come back when it’s time to repeat them.'
          : 'Words enter your review when you finish a unit’s Key phrases or Vocabulary step.')}>
          <span className="chev">›</span>
          <h2>🗂️ Daily review</h2>
          <p className="muted">{due?.total ? 'All caught up ✓' : 'No words yet'}</p>
        </button>
      )}

      {/* A form with many controls: flat on the page so it gets the full width (cards are for single-tap tiles). */}
      <section className="flat-section">
        <h2>📝 Mixed test</h2>
        <p className="muted">A quiz across units and skills, scored per part.</p>

        {openTest && (
          <div className="resume">
            <Link className="btn btn-primary btn-block btn-big" to="/practice/test" style={{ textDecoration: 'none' }}>
              Continue your test<small>{openTest.total - new Set(openTest.queue).size} of {openTest.total} answered</small>
            </Link>
            <button className="btn btn-sm btn-ghost" onClick={async () => { await db.sessions.delete(TEST_KEY); toast('Test discarded.') }}>Discard</button>
          </div>
        )}

        <p className="section-label">Units</p>
        <div className="filters wrap">
          {units.map(u => (
            <button key={u.n} className={'btn btn-sm rounded-full ' + (picked.includes(u.n) ? 'btn-primary' : 'btn-soft')} onClick={() => setPicked(cur => toggle(cur, u.n))}>
              Unit {u.n}
            </button>
          ))}
          <button className="btn btn-sm rounded-full btn-soft" onClick={() => toast('Units 1–3 arrive in a later update.')}>Units 1–3 · soon</button>
        </div>

        <p className="section-label">Parts</p>
        <div className="filters wrap">
          {PARTS.map(p => (
            <button key={p.id} className={'btn btn-sm rounded-full ' + (parts.includes(p.id) ? 'btn-primary' : 'btn-soft')} onClick={() => setParts(cur => toggle(cur, p.id))}>{p.title}</button>
          ))}
        </div>

        <p className="section-label">Length</p>
        <div className="join w-full">
          {LENGTHS.map(n => (
            <button key={n} className={'btn join-item flex-1 ' + (length === n ? 'btn-primary' : '')} onClick={() => setLength(n)}>{n}</button>
          ))}
        </div>

        <button className="btn btn-primary btn-block btn-big" style={{ marginTop: 16, textAlign: 'center' }} onClick={start}>
          {openTest ? 'Start a new test' : 'Start test'}
        </button>
      </section>

      <button className="card tap" onClick={async () => {
        try {
          const items = listeningDrill(units, 15)
          await db.sessions.put({ key: 'listening', queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString(), items })
          navigate('/drill/run/listening')
        } catch (e) { toast(`Couldn't start listening practice: ${(e as Error).message}`, 'error') }
      }}>
        <span className="chev">›</span>
        <h2>🎧 Listening</h2>
        <p className="muted">15 questions: meaning, dictation, what you heard, missing word, whole conversations</p>
      </button>

      <Link className="card tap" to="/practice/grammar">
        <span className="chev">›</span>
        <h2>📖 Grammar reference</h2>
        <p className="muted">All grammar topics, each with its own practice</p>
      </Link>

      <Link className="card tap" to="/practice/verbs">
        <span className="chev">›</span>
        <h2>🔤 Verb trainer</h2>
        <p className="muted">21 common verbs: tables with audio, drills, weak verbs first</p>
      </Link>
      <Link className="card tap" to="/reading">
        <span className="chev">›</span>
        <h2>📰 Reading</h2>
        <p className="muted">{readingTexts.length} short texts about Peniche, the beach, food and festivals{readCount ? ` · ${readCount} done` : ''}</p>
      </Link>
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
  const units = Object.values(a1Content).sort((a, b) => a.n - b.n)
  return (
    <main className="screen">
      <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice">‹ Practice</Link>
      <h1>Grammar</h1>
      {units.map(u => (
        <section key={u.id}>
          <p className="section-label">Unit {u.n} · {u.title}</p>
          {u.grammar.topics.map(t => (
            <Link key={t.id} className="card tap" to={`/grammar/${u.n}/${t.id}`}>
              <span className="chev">›</span>
              <h2>{t.title}</h2>
              <p className="muted">{t.exercises.length} practice questions</p>
            </Link>
          ))}
        </section>
      ))}
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
