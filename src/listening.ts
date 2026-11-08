// Listening exercises generated from the recorded lines: dictation, pick what you heard,
// fill the gap you hear, and questions about a whole conversation.
import type { Dialogue, Exercise, Unit } from './content/types'
import { normalize } from './match'
import { shuffle } from './test'

type Clip = { id: string; pt: string }

const wordsOf = (s: string) => normalize(s).split(' ').filter(Boolean)

/** Hear it, type it. */
export function dictation(c: Clip): Exercise {
  return { id: `ld-${c.id}`, type: 'dictation', part: 'listening', audio: c.id, answers: [c.pt] }
}

/** Hear it, pick it from similar-looking Portuguese sentences (most shared words first). */
export function listenPick(c: Clip, pool: Clip[], rand: () => number): Exercise {
  const mine = new Set(wordsOf(c.pt))
  const seen = new Set([normalize(c.pt)])
  const others: string[] = []
  const ranked = shuffle(pool, rand)
    .map(o => ({ o, score: wordsOf(o.pt).filter(w => mine.has(w)).length * 10 - Math.abs(o.pt.length - c.pt.length) / 4 }))
    .sort((a, b) => b.score - a.score)
  for (const { o } of ranked) {
    const n = normalize(o.pt)
    if (seen.has(n)) continue
    seen.add(n); others.push(o.pt)
    if (others.length === 3) break
  }
  const options = shuffle([c.pt, ...others], rand)
  return { id: `lp-${c.id}`, type: 'listen-pick', part: 'listening', audio: c.id, options, answer: options.indexOf(c.pt) }
}

/** Hear the whole sentence, type the missing word (the longest one). Needs at least two words. */
export function listenGap(c: Clip): Exercise | null {
  const tokens = c.pt.split(' ')
  if (tokens.length < 2) return null
  const cores = tokens.map(t => t.match(/[\p{L}-]+/u)?.[0] ?? '')
  let best = -1
  cores.forEach((w, i) => { if (w.length >= 3 && (best < 0 || w.length > cores[best].length)) best = i })
  if (best < 0) return null
  const pt = tokens.map((t, i) => (i === best ? t.replace(cores[i], '___') : t)).join(' ')
  return { id: `lg-${c.id}`, type: 'listen-gap', part: 'listening', audio: c.id, pt, answers: [cores[best]] }
}

/** Questions about a whole conversation (heard without the text). */
export function dialogueQuestions(d: Dialogue, rand: () => number): Exercise[] {
  const clips = d.lines.map(l => l.id)
  const lines = d.lines.map(l => ({ name: d.speakers[l.speaker]?.name ?? '', pt: l.pt }))
  return (d.questions ?? []).map(q => {
    const options = shuffle(q.options, rand)
    return { id: `lq-${q.id}`, type: 'listen-dialogue', part: 'listening', clips, title: d.title, lines, question: q.q, options, answer: options.indexOf(q.options[q.answer]) }
  })
}

export function lineExercise(kind: 'pick' | 'dictation' | 'gap', c: Clip, pool: Clip[], rand: () => number): Exercise {
  if (kind === 'pick') return listenPick(c, pool, rand)
  if (kind === 'gap') return listenGap(c) ?? dictation(c)
  return dictation(c)
}

const clipsOf = (units: Unit[]): Clip[] =>
  units.flatMap(u => [...u.phrases, ...u.dialogues.flatMap(d => d.lines)]).map(x => ({ id: x.id, pt: x.pt }))

/** The new listening types, grouped by type: [pick, dictation, gap, conversation]. */
export function listeningExtras(units: Unit[], rand: () => number): Exercise[][] {
  const clips = clipsOf(units)
  return [
    clips.map(c => listenPick(c, clips, rand)),
    clips.map(dictation),
    clips.map(listenGap).filter((x): x is Exercise => !!x),
    units.flatMap(u => u.dialogues.flatMap(d => dialogueQuestions(d, rand))),
  ]
}
