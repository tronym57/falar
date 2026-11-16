import type { Exercise } from '../content/types'
import type { Answer } from './Exercises'
import { wordDiff, type Piece } from '../diff'

/** Typed answers: once answered, the field gives way to the answer box. Picked options and table answers don't need it. */
export const isTyped = (ex: Exercise) =>
  ex.type === 'translate' || ex.type === 'conjugation' || ex.type === 'dictation' || ex.type === 'listen-gap' || ex.type === 'sentence-builder'
  || (ex.type === 'gap-fill' && !ex.options)

/** Accepted, but with a spelling or accent slip worth showing. */
export const isSlip = (ex: Exercise, a: Answer) => isTyped(ex) && a.result.ok && !!a.result.note && a.given !== a.result.expected

/**
 * Right under the question: the correct answer in big type, and what you wrote with the differences marked.
 * When it's right, just the correct spelling, so it's quick to read.
 */
export function AnswerDiff({ answer }: { answer: Answer }) {
  const { given, result } = answer
  const d = wordDiff(given, result.expected)
  const off = d.given.some(p => p.mark !== 'ok') || d.expected.some(p => p.mark !== 'ok')
  const kind = !result.ok ? 'off' : off ? 'slip' : 'right'
  return (
    <div className={'answer-diff ' + kind}>
      {given.trim() && kind !== 'right' && <>
        <p className="ad-label">You wrote</p>
        <p className="ad-given" lang="pt-PT"><Words pieces={d.given} side="given" /></p>
      </>}
      <p className="ad-label">{kind === 'off' ? 'Correct answer' : kind === 'slip' ? 'Correct spelling' : 'Your answer ✓'}</p>
      <p className="ad-expected" lang="pt-PT">{kind === 'right' ? result.expected : <Words pieces={d.expected} side="expected" />}</p>
    </div>
  )
}

function Words({ pieces, side }: { pieces: Piece[]; side: 'given' | 'expected' }) {
  return <>{pieces.map((p, i) => <span key={i}>{i > 0 && ' '}{p.mark === 'ok' ? p.text : <mark className={`mk-${p.mark} mk-${side}`}>{p.text}</mark>}</span>)}</>
}

/** The note on a right answer, minus the spelling part the answer box already shows ("Eu is fine…" stays). */
export function okNote(ex: Exercise, a: Answer) {
  if (!a.result.ok || !a.result.note) return null
  return (isTyped(ex) ? a.result.note.replace(/\s*(Watch the accents|Small typo)[\s\S]*$/, '').trim() : a.result.note) || null
}
