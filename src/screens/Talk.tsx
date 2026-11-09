import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { audio, useAudio } from '../audio'
import { AiError, useAi } from '../ai'
import { AiSetup } from '../components/AiSetup'
import { canRecognise, errorMessage, listen } from '../speech'
import { clearConversation, loadConversation, saveConversation, sceneById, scenes, sendTurn, type Conversation, type Message } from '../talk'
import { logAttempt } from '../progress'
import { useToast } from '../toast'
import { kv } from '../kv'

const AUTOPLAY = 'falar.talk.autoplay'

// ---------- /talk ----------
export default function TalkList() {
  const { connected } = useAi()
  const toast = useToast()
  return (
    <main className="screen">
      <Link className="btn btn-ghost btn-sm -ml-3 text-primary" to="/practice">‹ Practice</Link>
      <h1>Conversation</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Role-play real situations with an AI partner who speaks European Portuguese. Talk or type; it corrects you gently and helps when you're stuck.</p>
      {!connected && <AiSetup />}
      {scenes.map(s => (
        <Link key={s.id} className={'card tap' + (connected ? '' : ' locked')} to={`/talk/${s.id}`} onClick={e => {
          if (connected) return
          e.preventDefault(); toast('Connect Gemini first (the card above), then pick a scene.')
        }}>
          <span className="chev">›</span>
          <h2>{s.emoji} {s.title}</h2>
          <p className="muted">{s.en}</p>
          <p className="small muted" style={{ marginTop: 6 }}>{s.tasks.length ? `${s.tasks.length} tasks · ` : 'Free talk · '}after Unit {s.unit}</p>
        </Link>
      ))}
    </main>
  )
}

// ---------- /talk/:id ----------
export function TalkChat() {
  const { id } = useParams()
  const scene = sceneById(id ?? '')
  const { connected } = useAi()
  const toast = useToast()
  const { playing } = useAudio()
  const [c, setC] = useState<Conversation | null>(() => (scene ? loadConversation(scene) : null))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [showEn, setShowEn] = useState(false)
  const [hint, setHint] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoplay, setAutoplay] = useState(kv.get(AUTOPLAY) !== '0')
  const stopRef = useRef<() => void>(() => {})
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => { stopRef.current(); audio.stop() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [c?.messages.length, busy])

  if (!scene || !c) return <Navigate to="/talk" replace />
  if (!connected) return <Navigate to="/talk" replace />

  const last = [...c.messages].reverse().find(m => m.who === 'ai')
  const allDone = scene.tasks.length > 0 && scene.tasks.every((_, i) => c.tasksDone.includes(i + 1))

  const update = (next: Conversation) => { setC(next); saveConversation(next) }

  const send = async (raw: string) => {
    const said = raw.trim()
    if (!said) return toast('Say or type something first.')
    if (busy) return
    setText(''); setHint(false); setError(null)
    const mine: Message = { who: 'me', id: `m${c.messages.length}`, text: said }
    const withMine = { ...c, messages: [...c.messages, mine] }
    update(withMine)
    setBusy(true)
    logAttempt(-1, 'talk', `talk-${scene.id}`, true, said).catch(() => {})
    try {
      const { value: r, problems } = await sendTurn(scene, withMine.messages)
      const messages = withMine.messages.map(m => (m === mine ? { ...mine, correction: r.correction } : m))
      const ai: Message = { who: 'ai', id: `m${messages.length}`, pt: r.reply, en: r.reply_en, suggestion: r.suggestion, warn: problems.length ? problems : undefined }
      const tasksDone = [...new Set([...c.tasksDone, ...(r.tasks_done ?? []).filter(n => n >= 1 && n <= scene.tasks.length)])]
      update({ ...withMine, messages: [...messages, ai], tasksDone })
      if (autoplay) audio.speak(ai.id, ai.pt)
    } catch (e) {
      setError(e instanceof AiError ? e.message : `Something went wrong: ${(e as Error).message}`)
    } finally { setBusy(false) }
  }

  const mic = () => {
    if (busy) return toast('Wait for the answer first.')
    if (listening) return stopRef.current()
    if (!canRecognise()) return toast("Speech recognition isn't available here. Type your answer instead.")
    setListening(true); setText('')
    stopRef.current = listen({
      onInterim: setText,
      onEnd: h => {
        setListening(false)
        if (h.text) send(h.text)
        else toast(errorMessage(h.error))
      },
    })
  }

  const restart = () => {
    if (!confirm('Start this conversation again from the beginning?')) return
    clearConversation(scene.id); audio.stop()
    setC(loadConversation(scene)); setError(null); setHint(false)
  }

  return (
    <main className="screen practice talk">
      <div className="practice-head">
        <Link className="btn btn-ghost btn-circle btn-sm text-xl" to="/talk" aria-label="Close (the conversation is saved)">✕</Link>
        <b className="talk-title">{scene.emoji} {scene.title}</b>
        <button className={'btn btn-sm ' + (showEn ? 'btn-primary' : 'btn-tonal')} onClick={() => setShowEn(v => !v)}>EN</button>
        <button className={'btn btn-sm ' + (autoplay ? 'btn-primary' : 'btn-tonal')} aria-label="Read replies aloud" onClick={() => { const v = !autoplay; setAutoplay(v); kv.set(AUTOPLAY, v ? '1' : '0'); toast(v ? 'Replies are read aloud.' : 'Replies are no longer read aloud.') }}>🔊</button>
      </div>

      {scene.tasks.length > 0 && (
        <div className="tasks">
          {scene.tasks.map((t, i) => {
            const done = c.tasksDone.includes(i + 1)
            return <span key={i} className={'task' + (done ? ' done' : '')}>{done ? '✓' : i + 1} {t}</span>
          })}
        </div>
      )}

      <div className="chat talk-chat">
        {c.messages.map((m, i) => m.who === 'ai' ? (
          <div key={m.id} className="chat-line them">
            {i === 0 && <span className="chat-name">{scene.character}</span>}
            <button className={'bubble tap' + (playing === m.id ? ' playing' : '')} onClick={() => audio.speak(m.id, m.pt)}>
              <span className="bubble-pt" lang="pt-PT">{m.pt}</span>
              {showEn && <span className="bubble-en">{m.en}</span>}
              <span className="bubble-play" aria-hidden>{playing === m.id ? '🔊' : '▶'}</span>
            </button>
            {m.warn && <span className="small muted">⚠️ May contain a Brazilian form: {m.warn[0]}</span>}
          </div>
        ) : (
          <div key={m.id} className="chat-line me">
            <div className="bubble"><span className="bubble-pt" lang="pt-PT">{m.text}</span></div>
            {m.correction && (
              <div className="correction">
                <span className="small muted">Better:</span> <b lang="pt-PT">{m.correction.better}</b>
                <span className="small">{m.correction.why}</span>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="chat-line them"><div className="bubble typing" aria-label={`${scene.character} is typing`}><span /><span /><span /></div></div>}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="card talk-error" role="alert">
          <p>{error}</p>
          <button className="btn btn-tonal btn-sm" onClick={() => {
            const lastMine = [...c.messages].reverse().find(m => m.who === 'me')
            if (lastMine && lastMine.who === 'me' && c.messages[c.messages.length - 1] === lastMine) {
              update({ ...c, messages: c.messages.slice(0, -1) }); send(lastMine.text)
            } else setError(null)
          }}>Try again</button>
        </div>
      )}

      {allDone && (
        <div className="card talk-done">
          <h2>🎉 All tasks done</h2>
          <p className="muted">{summary(c)} Keep chatting, or start again to try it more fluently.</p>
          <div className="row-btns">
            <button className="btn btn-tonal btn-block" onClick={restart}>Start again</button>
            <Link className="btn btn-tonal btn-block" to="/talk">Other scenes</Link>
          </div>
        </div>
      )}

      <div className="talk-bar">
        <AnimatePresence>
          {hint && last?.who === 'ai' && last.suggestion?.pt && (
            <motion.button key="hint" className="hint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} onClick={() => setText(last.suggestion!.pt)}>
              <b lang="pt-PT">{last.suggestion.pt}</b><span>{last.suggestion.en} · tap to use</span>
            </motion.button>
          )}
        </AnimatePresence>
        <div className="talk-input">
          <button className="btn btn-circle btn-tonal" aria-label="What could I say?" onClick={() => (last?.who === 'ai' && last.suggestion?.pt ? setHint(h => !h) : toast('No idea yet: answer the first line in your own words.'))}>💡</button>
          <input
            className="input flex-1"
            placeholder={listening ? 'Listening…' : 'Type, or tap the mic'}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(text)}
            lang="pt-PT" autoCapitalize="sentences" autoCorrect="off" spellCheck={false} enterKeyHint="send"
          />
          {text.trim() && !listening
            ? <button className="btn btn-circle btn-primary" aria-label="Send" onClick={() => send(text)}>➤</button>
            : <button className={'btn btn-circle ' + (listening ? 'btn-miss mic-on' : 'btn-primary')} aria-label={listening ? 'Stop listening' : 'Speak'} onClick={mic}>{listening ? '■' : '🎤'}</button>}
        </div>
        <button className="btn btn-ghost btn-xs talk-restart" onClick={restart}>Start again</button>
      </div>
    </main>
  )
}

function summary(c: Conversation) {
  const mine = c.messages.filter(m => m.who === 'me')
  const fixed = mine.filter(m => m.who === 'me' && m.correction).length
  return `You said ${mine.length} ${mine.length === 1 ? 'thing' : 'things'}${fixed ? `, ${fixed} with a correction to look at` : ', all without corrections'}.`
}
