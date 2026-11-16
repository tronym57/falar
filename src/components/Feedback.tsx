import { useEffect, useRef, useState } from 'react'
import { canSend, capture, NO_CAPTURE, screenContext, submitFeedback } from '../feedback'
import { useToast } from '../toast'

type Draft = { image: string; context: Record<string, unknown> }

/** A small tab on the right edge of every screen: tap it to send feedback with a screenshot of this screen. */
export function FeedbackButton() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  const open = async () => {
    if (busy) return
    setBusy(true)
    try {
      // The screenshot comes first, so the sheet isn't in it.
      const context = screenContext()
      setDraft({ image: await capture(), context })
    } catch (e) {
      toast(`Couldn't take the screenshot: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button className={`fb-tab ${NO_CAPTURE}`} onClick={open} aria-label="Give feedback on this screen">
      {busy ? <span className="loading loading-spinner loading-xs" /> : '✎'}
    </button>
    {draft && <Sheet draft={draft} onClose={() => setDraft(null)} />}
  </>
}

function Sheet({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [image, setImage] = useState(draft.image) // with your markings, once you add some
  const [marking, setMarking] = useState(false)
  const [marks, setMarks] = useState<Pt[][]>([]) // kept, so marking up again continues from them

  const send = async () => {
    if (!note.trim()) return toast('Write what should change first.')
    setSending(true)
    try {
      const r = await submitFeedback(note.trim(), image, draft.context)
      toast(r === 'sent' ? 'Feedback sent ✓ Claude Code will see it next time.'
        : canSend() ? 'Saved on this phone. It’s sent when you’re back online.'
          : 'Saved on this phone. Turn on GitHub backup in Settings to send it.')
      onClose()
    } catch (e) {
      toast(`Couldn't save it: ${(e as Error).message}`, 'error')
      setSending(false)
    }
  }

  return (
    <div className={`fb-overlay ${NO_CAPTURE}`} onClick={e => { if (e.target === e.currentTarget && !sending) onClose() }}>
      <form className="fb-sheet" role="dialog" aria-label="Feedback on this screen" onSubmit={e => { e.preventDefault(); send() }}>
        <h2>Feedback on this screen</h2>
        <div className="fb-preview">
          <button type="button" className="fb-shot" onClick={() => setMarking(true)} aria-label="Mark up the screenshot">
            <img src={image} alt="Screenshot of this screen" />
          </button>
          <div className="fb-preview-side">
            <button type="button" className="btn btn-tonal btn-sm" onClick={() => setMarking(true)}>✎ Mark up</button>
            <p className="small muted">{image === draft.image ? 'Circle or underline what you mean.' : 'Your markings are on it ✓'}</p>
            {image !== draft.image && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setImage(draft.image); setMarks([]) }}>Remove markings</button>}
          </div>
        </div>
        <textarea className="textarea w-full" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="What should change?" />
        <div className="fb-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn btn-primary" disabled={sending}>{sending ? <><span className="loading loading-spinner loading-sm" /> Sending…</> : 'Send'}</button>
        </div>
        <p className="small muted">Goes to your private feedback Gist on GitHub, with the screenshot and what's on this screen.</p>
      </form>
      {marking && <Markup image={draft.image} marks={marks} onCancel={() => setMarking(false)} onDone={(img, m) => { setImage(img); setMarks(m); setMarking(false) }} />}
    </div>
  )
}

type Pt = [number, number]

/** Full screen: draw on the screenshot with a finger. Long pages scroll in "Scroll" mode. */
function Markup({ image, marks, onDone, onCancel }: { image: string; marks: Pt[][]; onDone: (img: string, marks: Pt[][]) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [strokes, setStrokes] = useState<Pt[][]>(marks)
  const [scroll, setScroll] = useState(false)
  const drawing = useRef<Pt[] | null>(null)

  useEffect(() => {
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = image
  }, [image])

  const paint = (extra?: Pt[]) => {
    const c = canvas.current
    if (!c || !img) return
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    g.strokeStyle = '#e5172f'
    g.lineWidth = Math.max(4, img.naturalWidth / 110)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const s of extra ? [...strokes, extra] : strokes) {
      g.beginPath()
      s.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      if (s.length === 1) g.lineTo(s[0][0] + 0.1, s[0][1])
      g.stroke()
    }
  }
  useEffect(() => {
    if (canvas.current && img) { canvas.current.width = img.naturalWidth; canvas.current.height = img.naturalHeight }
  }, [img])
  useEffect(paint) // eslint-disable-line react-hooks/exhaustive-deps -- repaint after every change

  const at = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    return [(e.clientX - r.left) * (img!.naturalWidth / r.width), (e.clientY - r.top) * (img!.naturalHeight / r.height)]
  }
  const down = (e: React.PointerEvent) => {
    if (scroll || !img) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = [at(e)]
    paint(drawing.current)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    drawing.current.push(at(e))
    paint(drawing.current)
  }
  const up = () => {
    const s = drawing.current
    drawing.current = null
    if (s) setStrokes(xs => [...xs, s])
  }

  return (
    <div className={`fb-markup ${NO_CAPTURE}`} role="dialog" aria-label="Mark up the screenshot">
      <div className="fb-markup-bar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <div className="join">
          <button type="button" className={'btn btn-sm join-item ' + (!scroll ? 'btn-primary' : 'btn-tonal')} onClick={() => setScroll(false)}>✎ Draw</button>
          <button type="button" className={'btn btn-sm join-item ' + (scroll ? 'btn-primary' : 'btn-tonal')} onClick={() => setScroll(true)}>✋ Scroll</button>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onDone(strokes.length ? canvas.current!.toDataURL('image/jpeg', 0.8) : image, strokes)}>Done</button>
      </div>
      <div className="fb-markup-area">
        {!img ? <span className="loading loading-spinner" /> : (
          <canvas ref={canvas} className={scroll ? '' : 'drawing'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        )}
      </div>
      <div className="fb-markup-bar">
        <span className="small muted">{scroll ? 'Scroll to the part you mean, then tap Draw.' : 'Draw with your finger to circle or underline.'}</span>
        <span className="fb-markup-tools">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!strokes.length} onClick={() => setStrokes(xs => xs.slice(0, -1))}>↶ Undo</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!strokes.length} onClick={() => setStrokes([])}>Clear</button>
        </span>
      </div>
    </div>
  )
}
