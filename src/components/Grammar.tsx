import { Link } from 'react-router-dom'
import type { GrammarSection, GrammarTopic } from '../content/types'
import { AudioRow } from './AudioRow'
import { a1Content } from '../content'
import { topicRoundSize } from '../grammarPool'

/** One grammar topic: rule cards, tables, examples with audio, tips, Portugal-vs-Brazil note. */
/** `inLesson`: shown in the unit's Grammar step, so its practice returns there (at the next topic), not to the reference. */
export function GrammarTopicView({ unit, topic, index, inLesson }: { unit: number; topic: GrammarTopic; index?: number; inLesson?: boolean }) {
  return (
    <section className="topic" id={`topic-${topic.id}`}>
      <h2 className="topic-title">{index !== undefined && <span className="topic-n">{index + 1}</span>}{topic.title}</h2>
      {topic.sections.map((s, i) => <Section key={i} s={s} />)}
      <Link className="btn btn-primary btn-block btn-big" to={inLesson ? `/unit/${unit}/grammar/${topic.id}/practice` : `/drill/grammar/${unit}/${topic.id}`} style={{ textDecoration: 'none' }}>
        Practise this ({topicRoundSize(a1Content[unit], topic)} questions) ›
      </Link>
    </section>
  )
}

function Section({ s }: { s: GrammarSection }) {
  switch (s.type) {
    case 'rule':
      return (
        <div className="card rule">
          {s.title && <h3>{s.title}</h3>}
          <p>{s.text}</p>
        </div>
      )
    case 'table':
      return (
        <div className="card table-card">
          {s.caption && <h3>{s.caption}</h3>}
          <div className="table-wrap">
            <table className="table table-sm">
              <thead><tr>{s.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>{s.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )
    case 'examples':
      return (
        <div className="card">
          <h3>Examples</h3>
          {s.items.map(e => <AudioRow key={e.id} id={e.id} pt={e.pt} en={e.en} />)}
        </div>
      )
    case 'tip':
      return <div className="card tip"><h3>💡 Watch out</h3><p>{s.text}</p></div>
    case 'ep-note':
      return <div className="card ep-note"><h3>🇵🇹 Portugal vs 🇧🇷 Brazil</h3><p>{s.text}</p></div>
  }
}
