import { useEffect, useRef, useState } from 'react'
import { AiError, EUROPEAN_RULES, streamText, useAi } from '../ai'

const SYSTEM = `You explain a beginner's (A1) mistake in European Portuguese, in English, very briefly.
You get the task, what they wrote and the correct answer. Say what each wrong or missing word means and why the correct one fits here.
If what they wrote is also correct in Portugal, say so first.
Answer as 1–3 lines, each starting with "- ". At most 12 words a line. No markdown, no headings, no greeting.
${EUROPEAN_RULES}`

/** "Why?": Gemini explains the difference between your answer and the correct one, in a few short lines. */
export function WhyWrong({ task, given, expected }: { task: string; given: string; expected: string }) {
  const { connected } = useAi()
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)
  useEffect(() => () => ctl.current?.abort(), [])

  if (!connected || !given.trim()) return null

  const ask = async () => {
    setText('')
    setError(null)
    ctl.current = new AbortController()
    try {
      await streamText({
        system: SYSTEM,
        temperature: 0.2,
        signal: ctl.current.signal,
        turns: [{ role: 'user', text: `Task: ${task}\nThey wrote: ${given}\nCorrect answer: ${expected}` }],
        onText: setText,
      })
    } catch (e) {
      if (ctl.current?.signal.aborted) return
      setText(null)
      setError(e instanceof AiError ? e.message : `Something went wrong: ${(e as Error).message}`)
    }
  }

  const lines = (text ?? '').split('\n').map(l => l.replace(/^\s*[-*•]\s*/, '').replace(/\*\*/g, '').trim()).filter(Boolean)
  return text === null
    ? <>
      <button className="btn btn-ghost btn-block btn-sm why-btn" onClick={ask}>🤔 Why? Explain the difference</button>
      {error && <p className="small">{error}</p>}
    </>
    : <ul className="fb-points why-ai" aria-live="polite">
      {lines.length ? lines.map((l, i) => <li key={i}>{l}</li>) : <li className="muted"><span className="loading loading-dots loading-xs" /> Asking Gemini…</li>}
    </ul>
}
