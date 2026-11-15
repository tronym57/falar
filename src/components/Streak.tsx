import { Link } from 'react-router-dom'
import { MILESTONES, useStreak } from '../streak'

/** Home: the streak, the last 7 days, and one short line. Quiet on purpose. Opens Your stats. */
export function StreakCard() {
  const s = useStreak()
  if (!s) return null
  const milestone = s.today && MILESTONES.includes(s.current)
  const line = milestone ? `🎉 ${s.current} days in a row. Bom trabalho!`
    : s.today ? `Today ✓${s.best > s.current ? ` · best ${s.best} days` : ''}`
      : s.current ? 'Practise a little today to keep it going.'
        : 'Any practice today starts a streak.'
  return (
    <Link className="streak tap" to="/stats">
      <span className={'streak-n' + (s.today ? ' on' : '')}>🔥 {s.current}</span>
      <span className="streak-body">
        <span className="streak-days" aria-label="The last 7 days">
          {s.week.map(d => <span key={d.day} className={'streak-day' + (d.done ? ' done' : '')}><i />{d.label}</span>)}
        </span>
        <span className="streak-line">{line}</span>
      </span>
      <span className="streak-more" aria-hidden>›</span>
    </Link>
  )
}

/** One line on results screens. */
export function StreakLine() {
  const s = useStreak()
  if (!s?.today) return null
  return <p className="streak-result">🔥 {s.current === 1 ? 'Day 1 of your streak' : `${s.current} days in a row`}{MILESTONES.includes(s.current) ? '. Bom trabalho!' : ''}</p>
}
