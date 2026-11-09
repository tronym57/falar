import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { a1Content } from '../content'
import type { Exercise, Part } from '../content/types'
import { GrammarTopicView } from '../components/Grammar'
import { SlowToggle } from '../components/AudioRow'
import Practice from './Practice'
import { PARTS, generateTest, listeningDrill, speakingDrill } from '../test'
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
  // Speaking needs the mic, so it's opt-in for tests.
  const [parts, setParts] = useState<Part[]>(PARTS.map(p => p.id).filter(p => p !== 'speaking'))
  const [length, setLength] = useState(20)
  const [setup, setSetup] = useState(false) // show the new-test form while a test is unfinished

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

  const startDrill = async (key: string, items: Exercise[], label: string) => {
    try {
      await db.sessions.put({ key, queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString(), items })
      navigate(`/drill/run/${key}`)
    } catch (e) { toast(`Couldn't start ${label}: ${(e as Error).message}`, 'error') }
  }

  return (
    <main className="screen">
      <h1>Practice</h1>

      <p className="section-label">Every day</p>
      {due && due.count > 0 ? (
        <Link className="card tap" to="/review">
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
      <button className="card tap" onClick={() => startDrill('speaking', speakingDrill(units, 10), 'speaking practice')}>
        <span className="chev">›</span>
        <h2>🎤 Speaking</h2>
        <p className="muted">10 things to say out loud: prompts and replies from the dialogues</p>
      </button>
      <button className="card tap" onClick={() => startDrill('listening', listeningDrill(units, 15), 'listening practice')}>
        <span className="chev">›</span>
        <h2>🎧 Listening</h2>
        <p className="muted">15 questions: meaning, dictation, what you heard, missing word, whole conversations</p>
      </button>
      <Link className="card tap" to="/reading">
        <span className="chev">›</span>
        <h2>📰 Reading</h2>
        <p className="muted">{readingTexts.length} short texts about Peniche, food and festivals, or any topic you like{readCount ? ` · ${readCount} done` : ''}</p>
      </Link>
      <Link className="card tap" to="/practice/verbs">
        <span className="chev">›</span>
        <h2>🔤 Verb trainer</h2>
        <p className="muted">21 common verbs: tables with audio, drills, weak verbs first</p>
      </Link>
      <Link className="card tap" to="/practice/grammar">
        <span className="chev">›</span>
        <h2>📖 Grammar reference</h2>
        <p className="muted">All grammar topics, each with its own practice</p>
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
              {units.map(u => (
                <button key={u.n} className={'btn btn-sm rounded-full ' + (picked.includes(u.n) ? 'btn-primary' : 'btn-soft')} onClick={() => setPicked(cur => toggle(cur, u.n))}>
                  Unit {u.n}
                </button>
              ))}
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
