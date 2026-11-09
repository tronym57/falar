import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Exercise } from '../content/types'
import { AudioRow, SlowToggle } from '../components/AudioRow'
import { audio, useAudio } from '../audio'
import Practice from './Practice'
import { focusDrill, formAudio, isWeakVerb, masteryFrom, verbById, verbDrill, verbs, verbSet, type Mastery } from '../verbs'
import { useToast } from '../toast'
import { openAnyway, useDone, verbLearned } from '../learned'

type Filter = 'all' | 'irregular' | 'regular' | 'weak'

function useMastery() {
  return useLiveQuery(async () => masteryFrom(await db.attempts.where('exerciseId').startsWith('vb-').toArray()))
}

/** Save a generated drill as a session, then open the runner (closing the app keeps your place). */
async function startDrill(key: string, items: Exercise[], navigate: (to: string) => void) {
  await db.sessions.put({ key, queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString(), items })
  navigate(`/drill/run/${key}`)
}

function MasteryBadge({ m }: { m?: Mastery }) {
  if (!m) return <span className="badge badge-sm badge-soft badge-info">New</span>
  if (isWeakVerb(m)) return <span className="badge badge-sm badge-soft badge-error">Weak · {Math.round(m.score * 100)}%</span>
  return <span className="badge badge-sm badge-soft badge-success">{Math.round(m.score * 100)}%</span>
}

// ---------- /practice/verbs ----------
export default function VerbTrainer() {
  const toast = useToast()
  const navigate = useNavigate()
  const mastery = useMastery()
  const [filter, setFilter] = useState<Filter>('all')
  const done = useDone()
  const learned = (v: (typeof verbs)[number]) => !done || verbLearned(v, done)

  const shown = verbs.filter(v =>
    filter === 'all' ? true
      : filter === 'irregular' ? v.kind === 'irregular'
        : filter === 'regular' ? v.kind.startsWith('regular')
          : isWeakVerb(mastery?.[v.id]))
  const weakCount = mastery ? verbs.filter(v => isWeakVerb(mastery[v.id])).length : 0

  const open = shown.filter(learned)
  const practise = async () => {
    if (!shown.length) return toast(filter === 'weak' ? 'No weak verbs right now. Nice!' : 'No verbs in this filter.')
    if (!open.length) return toast('None of these verbs is open yet. Verbs open as you finish each unit’s Key phrases.')
    try { await startDrill('verbs', verbDrill(open, mastery ?? {}, 15), navigate) }
    catch (e) { toast(`Couldn't start the drill: ${(e as Error).message}`, 'error') }
  }

  const chips: [Filter, string][] = [['all', 'All'], ['irregular', 'Irregular'], ['regular', 'Regular'], ['weak', `Weak${weakCount ? ` (${weakCount})` : ''}`]]

  return (
    <main className="screen">
      <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice">‹ Practice</Link>
      <h1>Verbs</h1>
      <p className="muted" style={{ marginBottom: 12 }}>{verbs.length} common verbs in the {verbSet.title.toLowerCase()}. Drills use the verbs from units you've done (each opens with its unit's Key phrases); weak verbs come up more often.</p>

      <div className="filters">
        {chips.map(([k, label]) => (
          <button key={k} className={'btn btn-sm rounded-full ' + (filter === k ? 'btn-primary' : 'btn-soft')} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <button className="btn btn-primary btn-block btn-big" onClick={practise} style={{ marginBottom: 12 }}>
        Practise 15 questions<small>{open.length ? `${open.length} open ${open.length === 1 ? 'verb' : 'verbs'}${filter === 'all' ? '' : ` · ${chips.find(c => c[0] === filter)![1]}`}, weakest first` : 'No open verbs here yet'}</small>
      </button>

      {shown.length === 0 && <div className="card"><p className="muted">{filter === 'weak' ? 'No weak verbs. Practise more to see which ones need work.' : 'Nothing here.'}</p></div>}
      {shown.map(v => {
        const body = <>
          <span className="chev">›</span>
          <h2>{v.inf} <span className="muted" style={{ fontWeight: 400 }}>{v.en}</span></h2>
          <p className="muted small" style={{ margin: '2px 0 6px' }}>{v.forms.slice(0, 3).join(' · ')} …</p>
          <div className="flex gap-2"><span className="badge badge-sm badge-ghost">{v.kind}</span>{learned(v) ? <MasteryBadge m={mastery?.[v.id]} /> : <span className="badge badge-sm badge-soft">🔒 Unit {v.unit}</span>}</div>
        </>
        return learned(v)
          ? <Link key={v.id} to={`/verbs/${v.id}`} className="card tap verb-card">{body}</Link>
          : <button key={v.id} className="card tap verb-card soft-locked" onClick={() => openAnyway(navigate, `You learn “${v.inf}” in Unit ${v.unit}. It joins your drills when you finish that unit's Key phrases.`, `/verbs/${v.id}`)}>{body}</button>
      })}
    </main>
  )
}

// ---------- /verbs/:id ----------
export function VerbScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const mastery = useMastery()
  const { playing } = useAudio()
  const v = verbById[id ?? '']
  if (!v) return <Navigate to="/practice/verbs" replace />

  const drill = async (items: Exercise[]) => {
    try { await startDrill(`verb-${v.id}`, items, navigate) }
    catch (e) { toast(`Couldn't start the drill: ${(e as Error).message}`, 'error') }
  }
  const allForms = v.forms.map((_, i) => formAudio(v, i))
  const playingTable = allForms.includes(playing ?? '')

  return (
    <main className="screen">
      <div className="step-head">
        <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice/verbs">‹ Verbs</Link>
        <SlowToggle />
      </div>
      <h1 style={{ marginBottom: 4 }}>{v.inf}</h1>
      <p className="muted">{v.en}</p>
      <div className="flex gap-2" style={{ margin: '8px 0 14px' }}><span className="badge badge-ghost">{v.kind}</span><MasteryBadge m={mastery?.[v.id]} /></div>

      <section className="card">
        <div className="step-head" style={{ marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Present tense</h3>
          <button className="btn btn-sm btn-tonal" onClick={() => (playingTable ? audio.stop() : audio.playAll(allForms))}>
            {playingTable ? '■ Stop' : '▶ Play all'}
          </button>
        </div>
        {v.forms.map((f, i) => (
          <AudioRow key={i} id={formAudio(v, i)} pt={f} en={verbSet.persons[i]} />
        ))}
      </section>

      {v.note && <div className="card tip"><h3>💡 Good to know</h3><p>{v.note}</p></div>}

      <section className="card">
        <h3>Examples</h3>
        {v.examples.map(x => <AudioRow key={x.id} id={x.id} pt={x.pt} en={x.en} />)}
      </section>

      <button className="btn btn-primary btn-block btn-big" onClick={() => drill(focusDrill(v))}>Drill {v.inf}<small>Forms, sentences and the full table</small></button>
      <button className="btn btn-tonal btn-block btn-big" onClick={() => drill([focusDrill(v).at(-1)!])}>Just fill in the table</button>
    </main>
  )
}

// ---------- /drill/run/:key (generated drills) ----------
export function DrillRunner() {
  const { key } = useParams()
  // Load once: the session is deleted when the drill ends, but the results still need the questions.
  const [items, setItems] = useState<Exercise[] | null | undefined>(undefined)
  useEffect(() => { db.sessions.get(key ?? '').then(s => setItems(s?.items ?? null)).catch(() => setItems(null)) }, [key])
  if (items === undefined) return <main className="screen"><p className="muted">Loading…</p></main>
  const back = key === 'vocab' ? '/vocab' : key === 'listening' || key === 'speaking' ? '/practice' : key?.startsWith('verb-') ? `/verbs/${key.slice(5)}` : '/practice/verbs'
  if (!items) return <Navigate to={back} replace />
  return <Practice sessionKey={key!} items={items} mode="drill" closeTo={back} />
}
