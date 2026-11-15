import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { duration, KNOWN_DAYS, useStats, type Stats as S } from '../stats'
import { useToast } from '../toast'

/** Your usage: streak, time, activity over 30 days, words and course progress. Opened from the streak card on Home. */
export default function Stats() {
  const navigate = useNavigate()
  const s = useStats()
  return (
    <main className="screen">
      <div className="title-row">
        <button className="btn btn-ghost btn-circle btn-sm text-2xl text-primary -ml-2" aria-label="Back" onClick={() => (window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/')}>‹</button>
        <h1>Your stats</h1>
      </div>
      {!s ? <p className="muted">Loading…</p> : <Body s={s} />}
    </main>
  )
}

function Body({ s }: { s: S }) {
  const toast = useToast()
  const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : 0
  const wordsTotal = s.words.known + s.words.learning + s.words.notStarted
  const change = s.thisWeek - s.lastWeek
  return <>
    <div className="stat-grid">
      <Tile n={`🔥 ${s.streak}`} label="day streak" />
      <Tile n={String(s.best)} label="best streak" />
      <Tile n={String(s.daysPractised)} label={s.daysPractised === 1 ? 'day practised' : 'days practised'} />
      <Tile n={`≈ ${duration(s.minutes)}`} label="time practising"
        onTap={() => toast('Estimated from the time between your answers. Reading and listening without answering aren’t counted.')} />
    </div>

    <p className="section-label">Last 30 days</p>
    <div className="card">
      <Activity days={s.days} />
      <p className="muted mt-3">
        This week: <b className="text-base-content">{s.thisWeek}</b> answers and reviews, {duration(s.minutesThisWeek)}.{' '}
        {s.lastWeek > 0 && (change === 0 ? 'Same as last week.' : `${Math.abs(change)} ${change > 0 ? 'more' : 'fewer'} than last week.`)}
      </p>
    </div>

    <p className="section-label">Words</p>
    <div className="card">
      {wordsTotal === 0 ? <p className="muted">Words appear here once you finish a unit’s Key phrases or Vocabulary step.</p> : <>
        <div className="stat-bar" role="img" aria-label={`${s.words.known} known well, ${s.words.learning} learning, ${s.words.notStarted} not started`}>
          {s.words.known > 0 && <span className="known" style={{ flexGrow: s.words.known }} />}
          {s.words.learning > 0 && <span className="learning" style={{ flexGrow: s.words.learning }} />}
          {s.words.notStarted > 0 && <span className="new" style={{ flexGrow: s.words.notStarted }} />}
        </div>
        <Row k={<><i className="dot known" />Known well</>} v={s.words.known} onTap={() => toast(`Known well: you got it right often enough that it comes back in ${KNOWN_DAYS}+ days.`)} />
        <Row k={<><i className="dot learning" />Learning</>} v={s.words.learning} />
        <Row k={<><i className="dot new" />Not reviewed yet</>} v={s.words.notStarted} />
        {s.words.tricky > 0 && <Row k="Marked “Practise this more”" v={s.words.tricky} />}
      </>}
      <Row k="Your own words" v={s.ownWords} />
    </div>

    <p className="section-label">Practice</p>
    <div className="card">
      <Row k="Questions answered" v={s.answers} />
      {s.rightShare !== null && <Row k="Answers right" v={`${Math.round(s.rightShare * 100)}%`} />}
      <Row k="Review cards done" v={s.reviews} />
    </div>

    <p className="section-label">Course</p>
    <div className="card">
      <Row k="Steps finished" v={`${s.steps.done} of ${s.steps.total}`} />
      <progress className="progress progress-primary w-full my-3" value={pct(s.steps.done, s.steps.total)} max={100} />
      <Row k="Units complete" v={`${s.unitsComplete} of ${s.unitsTotal}`} />
    </div>
  </>
}

function Tile({ n, label, onTap }: { n: string; label: string; onTap?: () => void }) {
  const body = <><span className="stat-n">{n}</span><span className="stat-label">{label}{onTap && ' ⓘ'}</span></>
  return onTap ? <button className="card stat-tile tap" onClick={onTap}>{body}</button> : <div className="card stat-tile">{body}</div>
}

function Row({ k, v, onTap }: { k: React.ReactNode; v: React.ReactNode; onTap?: () => void }) {
  const inner = <><span>{k}{onTap && <span className="muted"> ⓘ</span>}</span><b>{v}</b></>
  return onTap ? <button className="row stat-row tap" onClick={onTap}>{inner}</button> : <div className="row stat-row">{inner}</div>
}

/** One bar per day; tap a bar to read it. Today is selected at first. */
function Activity({ days }: { days: S['days'] }) {
  const [sel, setSel] = useState(days.length - 1)
  const max = Math.max(1, ...days.map(d => d.count))
  const d = days[sel]
  return <>
    <p className="stat-readout"><b>{d.count}</b> {d.count === 1 ? 'answer or review' : 'answers and reviews'} · <span className="muted">{sel === days.length - 1 ? 'today' : d.label}</span></p>
    <div className="stat-chart" role="list" aria-label="Answers and reviews per day">
      {days.map((x, i) => (
        <button key={x.day} role="listitem" className={'stat-col' + (i === sel ? ' sel' : '')} onClick={() => setSel(i)} aria-label={`${x.label}: ${x.count}`}>
          <span style={{ height: x.count ? `max(4px, ${(x.count / max) * 100}%)` : 0 }} />
        </button>
      ))}
    </div>
    <div className="stat-axis"><span>{days[0].label}</span><span>Today</span></div>
  </>
}
