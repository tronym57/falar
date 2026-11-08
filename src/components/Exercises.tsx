import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Exercise } from '../content/types'
import { audio, useAudio } from '../audio'
import { check, type MatchResult } from '../match'
import { useToast } from '../toast'

export type Answer = { result: MatchResult; given: string }
type Props<T extends Exercise['type']> = {
  ex: Extract<Exercise, { type: T }>
  locked: boolean // true once answered: inputs freeze, feedback shows
  onAnswer: (a: Answer) => void
}

export function ExerciseView({ ex, locked, onAnswer }: { ex: Exercise; locked: boolean; onAnswer: (a: Answer) => void }) {
  switch (ex.type) {
    case 'listen-choose':
    case 'choose':
      return <Choose ex={ex} locked={locked} onAnswer={onAnswer} />
    case 'gap-fill':
      return <GapFill ex={ex} locked={locked} onAnswer={onAnswer} />
    case 'sentence-builder':
      return <SentenceBuilder ex={ex} locked={locked} onAnswer={onAnswer} />
    case 'translate':
      return <Typed ex={ex} locked={locked} onAnswer={onAnswer} prompt={<>Translate into Portuguese:<span className="ex-prompt">{ex.en}</span></>} answers={ex.answers} />
    case 'conjugation':
      return <Typed ex={ex} locked={locked} onAnswer={onAnswer} prompt={<>Conjugate <b>{ex.verb}</b>:<span className="ex-prompt">{ex.person} …</span></>} answers={ex.answers} />
  }
}

// ---------- multiple choice (text or listening) ----------
function Choose({ ex, locked, onAnswer }: Props<'listen-choose' | 'choose'>) {
  const [picked, setPicked] = useState<number | null>(null)
  const { playing } = useAudio()
  const listen = ex.type === 'listen-choose'

  useEffect(() => { if (listen) audio.autoplay(ex.id) }, [ex.id, listen])

  const pick = (i: number) => {
    if (locked) return
    setPicked(i)
    const expected = ex.options[ex.answer]
    onAnswer({ given: ex.options[i], result: i === ex.answer ? { ok: true, expected } : { ok: false, expected } })
  }

  return (
    <>
      {listen ? (
        <>
          <p className="ex-label">Listen. What does it mean?</p>
          <button className={'big-play tap' + (playing === ex.id ? ' playing' : '')} onClick={() => audio.play(ex.id)} aria-label="Play audio">
            {playing === ex.id ? '🔊' : '▶'}
          </button>
          {locked && <p className="reveal">{ex.pt}</p>}
        </>
      ) : (
        <p className="ex-label"><span className="ex-prompt">{ex.prompt}</span></p>
      )}
      <div className="options">
        {ex.options.map((o, i) => (
          <button
            key={i}
            className={'option tap' + (locked && i === ex.answer ? ' right' : '') + (locked && i === picked && i !== ex.answer ? ' wrong' : '')}
            onClick={() => pick(i)}
          >
            {o}
          </button>
        ))}
      </div>
    </>
  )
}

// ---------- fill the gap ----------
function GapFill({ ex, locked, onAnswer }: Props<'gap-fill'>) {
  const [before, after] = ex.pt.split('___')
  const [value, setValue] = useState('')

  const submit = (v: string) => {
    if (locked) return
    setValue(v)
    onAnswer({ given: v, result: check(v, ex.answers) })
  }

  return (
    <>
      <p className="ex-label">Fill the gap: <span className="muted">{ex.en}</span></p>
      <p className="gap-sentence">{before}<span className={'gap' + (value ? ' filled' : '')}>{value || '   '}</span>{after}</p>
      {ex.options ? (
        <div className="options row-options">
          {ex.options.map(o => (
            <button key={o} className={'option tap' + (locked && ex.answers.includes(o) ? ' right' : '') + (locked && o === value && !ex.answers.includes(o) ? ' wrong' : '')} onClick={() => submit(o)}>{o}</button>
          ))}
        </div>
      ) : (
        <TypedInput locked={locked} onSubmit={submit} />
      )}
    </>
  )
}

// ---------- build a sentence from tiles ----------
/** Stable shuffle per exercise, so reopening the app shows the same order. */
function seededShuffle<T>(items: T[], seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
  const a = items.map((v, i) => ({ v, i }))
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function SentenceBuilder({ ex, locked, onAnswer }: Props<'sentence-builder'>) {
  const toast = useToast()
  const tiles = useMemo(() => seededShuffle(ex.tiles, ex.id), [ex])
  const [chosen, setChosen] = useState<number[]>([]) // indexes into `tiles`

  const sentence = chosen.map(i => tiles[i].v).join(' ')
  const submit = () => {
    if (locked) return
    if (!chosen.length) return toast('Tap the words below to build the sentence first.')
    onAnswer({ given: sentence, result: check(sentence, [ex.answer]) })
  }

  return (
    <>
      <p className="ex-label">Build the sentence:<span className="ex-prompt">{ex.en}</span></p>
      <div className="built">
        {chosen.length === 0 && <span className="muted">Tap words to add them here</span>}
        {chosen.map(i => (
          <button key={i} className="tile tap" onClick={() => !locked && setChosen(c => c.filter(x => x !== i))}>{tiles[i].v}</button>
        ))}
      </div>
      <div className="tiles">
        {tiles.map((t, i) => (
          <button key={i} className={'tile tap' + (chosen.includes(i) ? ' used' : '')} onClick={() => {
            if (locked) return
            if (chosen.includes(i)) return toast('Already used. Tap it in your sentence to remove it.')
            setChosen(c => [...c, i])
          }}>{t.v}</button>
        ))}
      </div>
      {!locked && <button className="btn check-btn" onClick={submit}>Check</button>}
    </>
  )
}

// ---------- typed answer ----------
function Typed({ ex, locked, onAnswer, prompt, answers }: Props<'translate' | 'conjugation'> & { prompt: ReactNode; answers: string[] }) {
  return (
    <>
      <p className="ex-label">{prompt}</p>
      <TypedInput key={ex.id} locked={locked} onSubmit={v => onAnswer({ given: v, result: check(v, answers) })} />
    </>
  )
}

const ACCENTS = ['ã', 'õ', 'á', 'é', 'í', 'ó', 'ú', 'â', 'ê', 'ô', 'à', 'ç']

function TypedInput({ locked, onSubmit }: { locked: boolean; onSubmit: (v: string) => void }) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  const insert = (ch: string) => {
    const el = ref.current
    if (!el || locked) return
    const s = el.selectionStart ?? value.length
    const e = el.selectionEnd ?? value.length
    const next = value.slice(0, s) + ch + value.slice(e)
    setValue(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + 1, s + 1) })
  }
  const submit = () => {
    if (locked) return
    if (!value.trim()) return toast('Type your answer first.')
    onSubmit(value)
  }

  return (
    <>
      <input
        ref={ref}
        className="answer-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        readOnly={locked}
        lang="pt-PT"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Type in Portuguese"
      />
      {!locked && (
        <>
          <div className="accents">
            {ACCENTS.map(a => <button key={a} className="tile tap" onPointerDown={e => e.preventDefault()} onClick={() => insert(a)}>{a}</button>)}
          </div>
          <button className="btn check-btn" onClick={submit}>Check</button>
        </>
      )}
    </>
  )
}
