import type { Exercise } from '../content/types'
import type { Answer } from './Exercises'
import { wordDiff, type Piece } from '../diff'

/** Typed answers get the word-by-word comparison; picked options and table answers don't need it. */
export const showsDiff = (ex: Exercise, a: Answer) =>
  (ex.type === 'translate' || ex.type === 'conjugation' || ex.type === 'dictation' || ex.type === 'listen-gap' || ex.type === 'sentence-builder'
    || (ex.type === 'gap-fill' && !ex.options))
  && (!a.result.ok || !!a.result.note) && a.given !== a.result.expected

/** A typed answer that's off: what you wrote and the correct answer, right under the field, with the differences marked. */
export function AnswerDiff({ answer }: { answer: Answer }) {
  const { given, result } = answer
  const d = wordDiff(given, result.expected)
  const slip = result.ok // accepted, but with a spelling or accent slip
  return (
    <div className={'answer-diff ' + (slip ? 'slip' : 'off')}>
      {given.trim() && <>
        <p className="ad-label">You wrote</p>
        <p className="ad-given" lang="pt-PT"><Words pieces={d.given} side="given" /></p>
      </>}
      <p className="ad-label">{slip ? 'Correct spelling' : 'Correct answer'}</p>
      <p className="ad-expected" lang="pt-PT"><Words pieces={d.expected} side="expected" /></p>
    </div>
  )
}

function Words({ pieces, side }: { pieces: Piece[]; side: 'given' | 'expected' }) {
  return <>{pieces.map((p, i) => <span key={i}>{i > 0 && ' '}{p.mark === 'ok' ? p.text : <mark className={`mk-${p.mark} mk-${side}`}>{p.text}</mark>}</span>)}</>
}
