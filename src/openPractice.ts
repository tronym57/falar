// Unfinished practices, for "Pick up where you stopped" on Home: what each one is, and where it runs.
import type { PracticeSession, StepProgress } from './db'
import { a1Content } from './content'
import { unitSteps } from './units'
import { readingTexts } from './content/reading'
import { verbById } from './verbs'

const stepTitle = (slug: string) => unitSteps.find(s => s.slug === slug)?.title ?? slug

/** A short name for a practice, from its session key. */
export function practiceTitle(key: string): string {
  let m = key.match(/^lesson-(\d+)-(\w+)$/)
  if (m) return `Unit ${m[1]} · ${stepTitle(m[2])} practice`
  m = key.match(/^(\d+):(\w+)$/)
  if (m) return `Unit ${m[1]} · ${stepTitle(m[2])}`
  m = key.match(/^drill:(.+)$/)
  if (m) {
    const topic = Object.values(a1Content).flatMap(u => u.grammar.topics).find(t => t.id === m![1])
    return topic ? `Grammar · ${topic.title}` : 'Grammar practice'
  }
  m = key.match(/^reading-(.+)$/)
  if (m) return `Reading · ${readingTexts.find(t => t.id === m![1])?.title ?? 'questions'}`
  m = key.match(/^verb-(.+)$/)
  if (m) return `Verb drill · ${verbById[m[1]]?.inf ?? m[1]}`
  return ({ vocab: 'Vocabulary training', verbs: 'Verb drill', lookalikes: 'Look-alikes', listening: 'Listening practice', speaking: 'Speaking practice', test: 'Mixed test' } as Record<string, string>)[key] ?? 'Practice'
}

/** Where a practice runs. Saved with the session; older sessions fall back to the key. */
export function practiceRoute(s: PracticeSession): string | null {
  if (s.route) return s.route
  let m = s.key.match(/^lesson-(\d+)-(\w+)$/)
  if (m) return `/unit/${m[1]}/${m[2]}/practice`
  m = s.key.match(/^(\d+):(exercises|check)$/)
  if (m) return `/unit/${m[1]}/${m[2]}`
  if (s.key === 'test') return '/practice/test'
  if (/^(vocab|verbs|lookalikes|listening|speaking|verb-.+)$/.test(s.key)) return `/drill/run/${s.key}`
  return null
}

/** The unit step a practice belongs to, as a progress key (`0:phrases`). */
const stepKey = (key: string) => {
  const m = key.match(/^lesson-(\d+)-(\w+)$/) ?? key.match(/^(\d+):(\w+)$/)
  return m ? `${m[1]}:${m[2]}` : null
}

/**
 * Practices with at least one answer, most recent first. Leaves out an old one for a step
 * that was done after it started (it's not really unfinished, see the unit overview).
 */
export function openPractices(sessions: PracticeSession[], progress: StepProgress[] = []) {
  const done = new Map(progress.filter(p => p.done).map(p => [p.key, p.updatedAt]))
  const stale = (s: PracticeSession) => { const k = stepKey(s.key); const at = k && done.get(k); return !!at && s.startedAt < at }
  return sessions
    .map(s => ({ s, answered: Object.keys(s.firstTry).length, to: practiceRoute(s) }))
    .filter((x): x is { s: PracticeSession; answered: number; to: string } => x.answered > 0 && !!x.to && !stale(x.s))
    .sort((a, b) => (b.s.updatedAt ?? b.s.startedAt).localeCompare(a.s.updatedAt ?? a.s.startedAt))
}
