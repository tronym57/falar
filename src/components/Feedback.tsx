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

/** Where the screenshot sits in the markup area: scale and top-left offset, in screen pixels. */
type View = { s: number; x: number; y: number }
const MAX_ZOOM = 6

/**
 * Full screen: the whole screenshot fits at first. One finger draws; two fingers move and pinch to zoom.
 */
function Markup({ image, marks, onDone, onCancel }: { image: string; marks: Pt[][]; onDone: (img: string, marks: Pt[][]) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [strokes, setStrokes] = useState<Pt[][]>(marks)
  const [view, setView] = useState<View | null>(null)
  const [fit, setFit] = useState<View | null>(null) // the whole screenshot, centred
  const drawing = useRef<Pt[] | null>(null)
  const fingers = useRef(new Map<number, Pt>()) // pointer id → screen point (in the area)
  const pinch = useRef<{ d: number; m: Pt; v: View } | null>(null)

  useEffect(() => {
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = image
  }, [image])

  // Fit the whole screenshot in the area, centred.
  useEffect(() => {
    if (!img || !area.current) return
    const { width: W, height: H } = area.current.getBoundingClientRect()
    const s = Math.min(W / img.naturalWidth, H / img.naturalHeight)
    const all = { s, x: (W - img.naturalWidth * s) / 2, y: (H - img.naturalHeight * s) / 2 }
    setFit(all)
    setView(all)
    if (canvas.current) { canvas.current.width = img.naturalWidth; canvas.current.height = img.naturalHeight }
  }, [img])

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
  useEffect(paint) // eslint-disable-line react-hooks/exhaustive-deps -- repaint after every change

  const local = (e: React.PointerEvent): Pt => {
    const r = area.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }
  const toImage = ([x, y]: Pt, v: View): Pt => [(x - v.x) / v.s, (y - v.y) / v.s]
  const twoFingers = () => {
    const [a, b] = [...fingers.current.values()]
    return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Pt }
  }

  const down = (e: React.PointerEvent) => {
    if (!view) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not a live pointer */ }
    fingers.current.set(e.pointerId, local(e))
    if (fingers.current.size === 1) {
      drawing.current = [toImage(local(e), view)]
      paint(drawing.current)
    } else if (fingers.current.size === 2) {
      // A second finger: it's a move or a zoom, not a drawing.
      drawing.current = null
      paint()
      pinch.current = { ...twoFingers(), v: view }
    }
  }
  const move = (e: React.PointerEvent) => {
    if (!fingers.current.has(e.pointerId) || !view) return
    fingers.current.set(e.pointerId, local(e))
    if (pinch.current && fingers.current.size >= 2 && fit) {
      const { d, m } = twoFingers()
      const p = pinch.current
      const s = Math.min(fit.s * MAX_ZOOM, Math.max(fit.s, p.v.s * (d / p.d)))
      const [ix, iy] = toImage(p.m, p.v) // the point that was between the fingers stays between them
      setView({ s, x: m[0] - ix * s, y: m[1] - iy * s })
    } else if (drawing.current) {
      drawing.current.push(toImage(local(e), view))
      paint(drawing.current)
    }
  }
  const up = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId)
    if (fingers.current.size < 2) pinch.current = null
    const s = drawing.current
    drawing.current = null
    if (s) setStrokes(xs => [...xs, s])
  }

  const zoomed = !!view && !!fit && view.s > fit.s * 1.01

  return (
    <div className={`fb-markup ${NO_CAPTURE}`} role="dialog" aria-label="Mark up the screenshot">
      <div className="fb-markup-bar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        {zoomed && <button type="button" className="btn btn-tonal btn-sm" onClick={() => setView(fit)}>Show all</button>}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onDone(strokes.length ? canvas.current!.toDataURL('image/jpeg', 0.8) : image, strokes)}>Done</button>
      </div>
      <div ref={area} className="fb-markup-area" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {!img && <span className="loading loading-spinner" />}
        {img && <canvas ref={canvas} style={view ? { width: img.naturalWidth, height: img.naturalHeight, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` } : { visibility: 'hidden' }} />}
      </div>
      <div className="fb-markup-bar">
        <span className="small muted">One finger draws. Two fingers move and zoom.</span>
        <span className="fb-markup-tools">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!strokes.length} onClick={() => setStrokes(xs => xs.slice(0, -1))}>↶ Undo</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!strokes.length} onClick={() => setStrokes([])}>Clear</button>
        </span>
      </div>
    </div>
  )
}
