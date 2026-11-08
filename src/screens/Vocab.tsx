import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ReviewCard } from '../db'
import { a1Content } from '../content'
import { AudioRow, SlowToggle } from '../components/AudioRow'
import { addCustomWord, cardFaces, deleteCustomWord, intervalLabel, isWeak, State, type CardFace } from '../review'
import { useToast } from '../toast'
import { rng, wordQuestions } from '../test'

const TRAIN_LENGTH = 15

type Filter = 'all' | 'due' | 'weak' | 'mine' | `unit-${number}`

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function status(c: ReviewCard | undefined, unit: number, now: Date): { label: string; cls: string } {
  // No review card yet: the word joins your daily review once you finish its unit lesson.
  if (!c) return { label: `Learn in Unit ${unit}`, cls: '' }
  if (c.fsrs.state === State.New) return { label: 'New', cls: 'badge-info' }
  if (isWeak(c)) return { label: 'Weak', cls: 'badge-error' }
  if (new Date(c.fsrs.due) <= now) return { label: 'Due', cls: 'badge-warning' }
  return { label: `Next in ${intervalLabel(new Date(c.fsrs.due), now)}`, cls: 'badge-success' }
}

export default function Vocab() {
  const toast = useToast()
  const navigate = useNavigate()
  const data = useLiveQuery(async () => ({ cards: await db.cards.toArray(), custom: await db.customWords.toArray() }))
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)

  if (!data) return <main className="screen"><h1>Vocabulary</h1><p className="muted">Loading…</p></main>

  const now = new Date()
  const cards = Object.fromEntries(data.cards.map(c => [c.id, c]))
  const faces = Object.values(cardFaces(data.custom))
  const units = Object.values(a1Content).sort((a, b) => a.n - b.n)

  const shown = faces.filter((f: CardFace) => {
    const c = cards[f.id]
    if (filter === 'mine' && !f.custom) return false
    if (filter === 'weak' && !(c && isWeak(c))) return false
    if (filter === 'due' && !(c && c.fsrs.state !== State.New && new Date(c.fsrs.due) <= now)) return false
    if (filter.startsWith('unit-') && f.unit !== Number(filter.slice(5))) return false
    return !q || fold(f.pt).includes(fold(q)) || fold(f.en).includes(fold(q))
  })

  // Train the words on screen: weakest first, then due, then the rest in random order.
  const train = async () => {
    if (!shown.length) return toast('No words to train in this list. Change the filter or search.')
    const rand = rng(Date.now())
    const rank = (f: CardFace) => { const c = cards[f.id]; return c && isWeak(c) ? 0 : c && new Date(c.fsrs.due) <= now ? 1 : 2 }
    const picked = shown.map(f => ({ f, r: rank(f) + rand() })).sort((a, b) => a.r - b.r).slice(0, TRAIN_LENGTH).map(x => x.f)
    const items = wordQuestions(picked, faces.map(f => f.en), 'w', rand)
    try {
      await db.sessions.put({ key: 'vocab', queue: items.map(x => x.id), total: items.length, firstTry: {}, startedAt: new Date().toISOString(), items })
      navigate('/drill/run/vocab')
    } catch (e) { toast(`Couldn't start training: ${(e as Error).message}`, 'error') }
  }

  const chips: [Filter, string][] = [['all', 'All'], ['due', 'Due'], ['weak', 'Weak'], ['mine', 'My words'], ...units.map(u => [`unit-${u.n}`, `Unit ${u.n}`] as [Filter, string])]

  return (
    <main className="screen">
      <div className="step-head"><h1 style={{ margin: 0 }}>Vocabulary</h1><SlowToggle /></div>
      <input className="input w-full mb-3" type="search" placeholder="Search Portuguese or English" value={q} onChange={e => setQ(e.target.value)} />
      <div className="filters">
        {chips.map(([k, label]) => (
          <button key={k} className={'btn btn-sm rounded-full ' + (filter === k ? 'btn-primary' : 'btn-soft')} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <button className="btn btn-primary btn-block btn-big" style={{ marginBottom: 12 }} onClick={train}>
        Train these words<small>{Math.min(shown.length, TRAIN_LENGTH)} questions · weakest first</small>
      </button>
      {adding ? <AddWord onDone={() => setAdding(false)} /> : (
        <button className="btn btn-tonal btn-block btn-big" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}>+ Add a word you heard</button>
      )}

      <section className="card">
        <p className="muted">{shown.length} {shown.length === 1 ? 'item' : 'items'}</p>
        {shown.length === 0 && <p>{filter === 'mine' ? 'You haven’t added any words yet.' : 'Nothing matches.'}</p>}
        {shown.map(f => {
          const st = status(cards[f.id], f.unit, now)
          return (
            <div key={f.id}>
              <AudioRow id={f.id} pt={f.pt} en={f.en} tts={f.custom} aside={<span className={'badge badge-sm badge-soft ' + st.cls}>{st.label}</span>} />
              {f.custom && (
                <button className="btn btn-xs btn-ghost text-error px-0" onClick={async () => {
                  if (!confirm(`Delete "${f.pt}" from your words?`)) return
                  try { await deleteCustomWord(f.id); toast(`Deleted "${f.pt}".`) }
                  catch (e) { toast(`Couldn't delete: ${(e as Error).message}`, 'error') }
                }}>Delete</button>
              )}
            </div>
          )
        })}
      </section>
    </main>
  )
}

function AddWord({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [pt, setPt] = useState('')
  const [en, setEn] = useState('')
  const save = async () => {
    if (!pt.trim() || !en.trim()) return toast('Fill in both the Portuguese and the English.')
    try {
      await addCustomWord(pt, en)
      toast(`Added "${pt.trim()}". It shows up in your daily review.`)
      onDone()
    } catch (e) {
      toast(`Couldn't save the word: ${(e as Error).message}`, 'error')
    }
  }
  return (
    <div className="card add-form">
      <h2>Add a word</h2>
      <input className="input w-full" placeholder="Portuguese, e.g. a onda" value={pt} onChange={e => setPt(e.target.value)} lang="pt-PT" autoCapitalize="none" autoCorrect="off" />
      <input className="input w-full" placeholder="English, e.g. the wave" value={en} onChange={e => setEn(e.target.value)} />
      <p className="muted" style={{ fontSize: 13 }}>Played with the iPhone voice (Joana), since there's no recording for your own words.</p>
      <div className="row-btns">
        <button className="btn btn-primary btn-block btn-big" onClick={save}>Save</button>
        <button className="btn btn-tonal btn-block btn-big" style={{ marginTop: 0 }} onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}
