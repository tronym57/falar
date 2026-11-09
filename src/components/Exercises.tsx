import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Exercise } from '../content/types'
import { audio, useAudio } from '../audio'
import { check, type MatchResult } from '../match'
import { useToast } from '../toast'
import { motion } from 'motion/react'
import { canRecognise, errorMessage, listen, micBlocked, retryMic, type Heard } from '../speech'
import { SPEAK_PASS, bestMatch, type SpeakScore } from '../speakMatch'
import { SlowToggle } from './AudioRow'

/** An answer option: a small pop when it's the right one, a gentle shake when your pick was wrong. */
function Option({ state, children, onClick }: { state: 'right' | 'wrong' | null; children: ReactNode; onClick: () => void }) {
  return (
    <motion.button
      className={'option' + (state ? ' ' + state : '')}
      onClick={onClick}
      animate={state === 'right' ? { scale: [1, 1.04, 1] } : state === 'wrong' ? { x: [0, -7, 7, -4, 4, 0] } : undefined}
      transition={{ duration: state === 'wrong' ? 0.38 : 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.button>
  )
}

export type Answer = { result: MatchResult; given: string }
type Props<T extends Exercise['type']> = {
  ex: Extract<Exercise, { type: T }>
  locked: boolean // true once answered: inputs freeze, feedback shows
  onAnswer: (a: Answer) => void
}

export function ExerciseView({ ex, locked, onAnswer }: { ex: Exercise; locked: boolean; onAnswer: (a: Answer) => void }) {
  switch (ex.type) {
    case 'listen-choose':
    case 'listen-pick':
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
    case 'verb-table':
      return <VerbTable ex={ex} locked={locked} onAnswer={onAnswer} />
    case 'dictation':
      return <ListenTyped ex={ex} locked={locked} onAnswer={onAnswer} />
    case 'listen-gap':
      return <ListenTyped ex={ex} locked={locked} onAnswer={onAnswer} />
    case 'speak':
      return <Speak ex={ex} locked={locked} onAnswer={onAnswer} />
    case 'read-choose':
      return <ReadChoose ex={ex} locked={locked} onAnswer={onAnswer} />
    case 'listen-dialogue':
      return <ListenDialogue ex={ex} locked={locked} onAnswer={onAnswer} />
  }
}

// ---------- multiple choice (text or listening) ----------
function Choose({ ex, locked, onAnswer }: Props<'listen-choose' | 'listen-pick' | 'choose'>) {
  const [picked, setPicked] = useState<number | null>(null)

  const pick = (i: number) => {
    if (locked) return
    setPicked(i)
    const expected = ex.options[ex.answer]
    onAnswer({ given: ex.options[i], result: i === ex.answer ? { ok: true, expected } : { ok: false, expected } })
  }

  return (
    <>
      {ex.type === 'listen-choose' ? (
        <>
          <p className="ex-label">Listen. What does it mean?</p>
          <BigPlay clip={ex.audio ?? ex.id} />
          {locked && <p className="reveal">{ex.pt}</p>}
        </>
      ) : ex.type === 'listen-pick' ? (
        <>
          <p className="ex-label">Listen. Which one did you hear?</p>
          <BigPlay clip={ex.audio} />
        </>
      ) : (
        <p className="ex-label"><span className="ex-prompt">{ex.prompt}</span></p>
      )}
      <div className="options">
        {ex.options.map((o, i) => (
          <Option key={i} state={locked && i === ex.answer ? 'right' : locked && i === picked ? 'wrong' : null} onClick={() => pick(i)}>{o}</Option>
        ))}
      </div>
    </>
  )
}

// ---------- listening helpers ----------
/** The big round play button; plays once by itself when the question appears. */
function BigPlay({ clip }: { clip: string }) {
  const { playing } = useAudio()
  useEffect(() => { audio.autoplay(clip) }, [clip])
  return (
    <div className="big-play-wrap">
      <button className={'btn btn-circle big-play ' + (playing === clip ? 'btn-soft btn-primary' : 'btn-primary')} onClick={() => audio.play(clip)} aria-label="Play audio">
        {playing === clip ? '🔊' : '▶'}
      </button>
      {/* Switching speed plays the clip again, so you hear the difference straight away. */}
      <SlowToggle onChange={() => audio.play(clip)} />
    </div>
  )
}

// ---------- hear it, type it (whole sentence or the missing word) ----------
function ListenTyped({ ex, locked, onAnswer }: Props<'dictation' | 'listen-gap'>) {
  const [value, setValue] = useState('')
  const gap = ex.type === 'listen-gap'
  const [before, after] = gap ? ex.pt.split('___') : ['', '']
  return (
    <>
      <p className="ex-label">{gap ? 'Listen and type the missing word.' : 'Listen and type what you hear.'}</p>
      <BigPlay clip={ex.audio} />
      {gap && <p className="gap-sentence">{before}<span className="gap-slot">{value || '   '}</span>{after}</p>}
      <TypedInput key={ex.id} locked={locked} onSubmit={v => { setValue(v); onAnswer({ given: v, result: check(v, ex.answers) }) }} />
    </>
  )
}

// ---------- a whole conversation, then a question ----------
function ListenDialogue({ ex, locked, onAnswer }: Props<'listen-dialogue'>) {
  const { playing } = useAudio()
  const [picked, setPicked] = useState<number | null>(null)
  const on = !!playing && ex.clips.includes(playing)
  const pick = (i: number) => {
    if (locked) return
    setPicked(i)
    const expected = ex.options[ex.answer]
    onAnswer({ given: ex.options[i], result: i === ex.answer ? { ok: true, expected } : { ok: false, expected } })
  }
  return (
    <>
      <p className="ex-label">Listen to the conversation: <b>{ex.title}</b></p>
      <button className={'btn btn-big btn-block ' + (on ? 'btn-tonal' : 'btn-primary')} onClick={() => (on ? audio.stop() : audio.playAll(ex.clips))}>
        {on ? '■ Stop' : '▶ Play the conversation'}
      </button>
      <div className="big-play-wrap" style={{ marginTop: 10 }}><SlowToggle /></div>
      <p className="ex-label" style={{ marginTop: 20 }}><span className="ex-prompt">{ex.question}</span></p>
      <div className="options">
        {ex.options.map((o, i) => (
          <Option key={i} state={locked && i === ex.answer ? 'right' : locked && i === picked ? 'wrong' : null} onClick={() => pick(i)}>{o}</Option>
        ))}
      </div>
      {locked && (
        <div className="transcript">
          {ex.lines.map((l, i) => <p key={i}><span className="muted">{l.name}:</span> {l.pt}</p>)}
        </div>
      )}
    </>
  )
}

// ---------- say it out loud (speech recognition, with a self-check fallback) ----------
function Speak({ ex, locked, onAnswer }: Props<'speak'>) {
  const { playing } = useAudio()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [heard, setHeard] = useState<Heard | null>(null)
  const [match, setMatch] = useState<SpeakScore | null>(null)
  const [misses, setMisses] = useState(0)
  const [selfCheck, setSelfCheck] = useState(!canRecognise() || micBlocked())
  const stopRef = useRef<() => void>(() => {})
  useEffect(() => () => stopRef.current(), [])
  // Role-play: the other person's line plays first.
  useEffect(() => { if (ex.cue) audio.autoplay(ex.cue.audio) }, [ex.cue])

  const start = () => {
    if (locked) return
    if (listening) return stopRef.current()
    setInterim(''); setHeard(null); setMatch(null); setListening(true)
    stopRef.current = listen({
      onInterim: setInterim,
      onEnd: h => {
        setListening(false)
        setHeard(h)
        if (!h.text) {
          if (h.error === 'unsupported' || h.error === 'not-allowed' || h.error === 'service-not-allowed') setSelfCheck(true)
          return setMisses(m => m + 1)
        }
        const m = bestMatch(ex.answers, h.alts)
        setMatch(m)
        if (m.score >= SPEAK_PASS) {
          const secs = h.startMs !== undefined ? ` · started after ${(h.startMs / 1000).toFixed(1)} s` : ''
          onAnswer({ given: h.text, result: { ok: true, expected: ex.pt, note: `Heard: “${h.text}”${secs}` } })
        } else setMisses(m => m + 1)
      },
    })
  }
  const self = (ok: boolean) => onAnswer({ given: '(self-checked)', result: ok ? { ok: true, expected: ex.pt, note: 'Marked as correct by you.' } : { ok: false, expected: ex.pt } })

  return (
    <>
      {ex.cue ? (
        <>
          <div className="chat" style={{ marginBottom: 20 }}>
            <div className="chat-line them">
              <span className="chat-name">{ex.cue.name}</span>
              <button className={'bubble tap' + (playing === ex.cue.audio ? ' playing' : '')} onClick={() => audio.play(ex.cue!.audio)}>
                <span className="bubble-pt">{ex.cue.pt}</span>
                <span className="bubble-en">{ex.cue.en}</span>
                <span className="bubble-play" aria-hidden>{playing === ex.cue.audio ? '🔊' : '▶'}</span>
              </button>
            </div>
          </div>
          <p className="ex-label">Your reply, out loud:<span className="ex-prompt">{ex.prompt}</span></p>
        </>
      ) : (
        <p className="ex-label">Say it in Portuguese:<span className="ex-prompt">{ex.prompt}</span></p>
      )}

      {!selfCheck && !locked && (
        <>
          <button className={'btn btn-circle big-play mic' + (listening ? ' listening' : '')} onClick={start} aria-label={listening ? 'Stop listening' : 'Start speaking'}>
            {listening ? '■' : '🎤'}
          </button>
          <p className="speak-status">
            {listening ? (interim ? `“${interim}”` : 'Listening… speak now') : heard && !match ? errorMessage(heard.error) : !heard ? 'Tap the mic and speak. It stops when you pause.' : ''}
          </p>
        </>
      )}

      {match && (
        <div className={'heard' + (match.score >= SPEAK_PASS ? ' ok' : '')}>
          <p className="small muted" style={{ margin: 0 }}>We heard: “{heard?.text}”</p>
          <p className="heard-words" lang="pt-PT">{match.words.map((w, i) => <span key={i} className={w.ok ? 'hit' : 'miss'}>{w.word} </span>)}</p>
          {!locked && <p className="small" style={{ margin: 0 }}>{Math.round(match.score * 100)}% of the words. Try again: tap the mic.</p>}
        </div>
      )}

      {!locked && (selfCheck || misses >= 2) && (
        <div className="self-check">
          <p className="small muted">
            {!canRecognise() ? "Speech recognition isn't available here. " : micBlocked() ? 'The microphone is blocked. ' : ''}
            Say it out loud, then check yourself against the answer:
          </p>
          {canRecognise() && micBlocked() && (
            <button className="btn btn-ghost btn-sm" onClick={() => { retryMic(); setSelfCheck(false); setMisses(0); setHeard(null) }}>🎤 Try the mic again</button>
          )}
          <button className="btn btn-tonal btn-block" onClick={() => audio.play(ex.audio)}>▶ Hear the answer: {ex.pt}</button>
          <div className="row-btns">
            <button className="btn btn-primary btn-block btn-big" onClick={() => self(true)}>I said it right</button>
            <button className="btn btn-tonal btn-block btn-big" onClick={() => self(false)}>Not yet</button>
          </div>
        </div>
      )}
    </>
  )
}

// ---------- a question about a reading text (text shown above, scrollable) ----------
function ReadChoose({ ex, locked, onAnswer }: Props<'read-choose'>) {
  const [picked, setPicked] = useState<number | null>(null)
  const pick = (i: number) => {
    if (locked) return
    setPicked(i)
    const expected = ex.options[ex.answer]
    onAnswer({ given: ex.options[i], result: i === ex.answer ? { ok: true, expected } : { ok: false, expected } })
  }
  return (
    <>
      <div className="read-box" lang="pt-PT">
        <p className="section-label" style={{ marginTop: 0 }}>{ex.title}</p>
        {ex.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <p className="ex-label"><span className="ex-prompt">{ex.question}</span></p>
      <div className="options">
        {ex.options.map((o, i) => (
          <Option key={i} state={locked && i === ex.answer ? 'right' : locked && i === picked ? 'wrong' : null} onClick={() => pick(i)}>{o}</Option>
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
    onAnswer({ given: v, result: check(v, ex.answers, { strict: ex.part === 'verbs' }) })
  }

  return (
    <>
      <p className="ex-label">Fill the gap: <span className="muted">{ex.en}</span></p>
      <p className="gap-sentence">{before}<span className="gap-slot">{value || '   '}</span>{after}</p>
      {ex.options ? (
        <div className="options row-options">
          {ex.options.map(o => (
            <Option key={o} state={locked && ex.answers.includes(o) ? 'right' : locked && o === value ? 'wrong' : null} onClick={() => submit(o)}>{o}</Option>
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
          <button key={i} className="btn tile" onClick={() => !locked && setChosen(c => c.filter(x => x !== i))}>{tiles[i].v}</button>
        ))}
      </div>
      <div className="tiles">
        {tiles.map((t, i) => (
          <button key={i} className={'btn tile' + (chosen.includes(i) ? ' used' : '')} onClick={() => {
            if (locked) return
            if (chosen.includes(i)) return toast('Already used. Tap it in your sentence to remove it.')
            setChosen(c => [...c, i])
          }}>{t.v}</button>
        ))}
      </div>
      {!locked && <button className="btn btn-primary btn-block btn-big check-btn" onClick={submit}>Check</button>}
    </>
  )
}

// ---------- typed answer ----------
function Typed({ ex, locked, onAnswer, prompt, answers }: Props<'translate' | 'conjugation'> & { prompt: ReactNode; answers: string[] }) {
  return (
    <>
      <p className="ex-label">{prompt}</p>
      <TypedInput key={ex.id} locked={locked} onSubmit={v => onAnswer({ given: v, result: check(v, answers, { strict: ex.part === 'verbs' }) })} />
    </>
  )
}

const ACCENTS = ['ã', 'õ', 'á', 'é', 'í', 'ó', 'ú', 'â', 'ê', 'ô', 'à', 'ç']

// ---------- fill in a whole conjugation table ----------
function VerbTable({ ex, locked, onAnswer }: Props<'verb-table'>) {
  const toast = useToast()
  const [values, setValues] = useState(() => ex.persons.map(() => ''))
  const [results, setResults] = useState<boolean[] | null>(null)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const focused = useRef(0)

  const insert = (ch: string) => {
    const i = focused.current
    const el = refs.current[i]
    if (!el || locked) return
    const s = el.selectionStart ?? values[i].length
    const e = el.selectionEnd ?? values[i].length
    setValues(v => v.map((x, j) => (j === i ? x.slice(0, s) + ch + x.slice(e) : x)))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + 1, s + 1) })
  }
  const submit = () => {
    if (locked) return
    if (values.some(v => !v.trim())) return toast('Fill in every form first.')
    const r = values.map((v, i) => check(v, [ex.answers[i]], { strict: true }))
    setResults(r.map(x => x.ok))
    const ok = r.every(x => x.ok)
    onAnswer({ given: values.join(', '), result: { ok, expected: ex.answers.join(' · ') } })
  }

  return (
    <>
      <p className="ex-label">Fill in the table:<span className="ex-prompt">{ex.verb} (present)</span></p>
      <div className="verb-table">
        {ex.persons.map((p, i) => (
          <label key={p} className={'verb-row' + (results ? (results[i] ? ' right' : ' wrong') : '')}>
            <span className="person">{p}</span>
            <input
              ref={el => { refs.current[i] = el }}
              className="input w-full"
              value={values[i]}
              onFocus={() => { focused.current = i }}
              onChange={e => setValues(v => v.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={e => { if (e.key === 'Enter') (i < ex.persons.length - 1 ? refs.current[i + 1]?.focus() : submit()) }}
              readOnly={locked}
              lang="pt-PT"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={i < ex.persons.length - 1 ? 'next' : 'done'}
            />
            {results && !results[i] && <span className="fix">{ex.answers[i]}</span>}
          </label>
        ))}
      </div>
      {!locked && (
        <>
          <div className="accents">
            {ACCENTS.map(a => <button key={a} className="btn btn-sm tile" onPointerDown={e => e.preventDefault()} onClick={() => insert(a)}>{a}</button>)}
          </div>
          <button className="btn btn-primary btn-block btn-big check-btn" onClick={submit}>Check</button>
        </>
      )}
    </>
  )
}

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
        className="input input-lg w-full"
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
            {ACCENTS.map(a => <button key={a} className="btn btn-sm tile" onPointerDown={e => e.preventDefault()} onClick={() => insert(a)}>{a}</button>)}
          </div>
          <button className="btn btn-primary btn-block btn-big check-btn" onClick={submit}>Check</button>
        </>
      )}
    </>
  )
}
