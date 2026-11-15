// Every Portuguese word the course uses, plus the verb tables. The answer check uses it to tell a typo
// ("chamass") from a different real word ("és" for "é", "se" for "te"), which is a mistake worth flagging.
import { a1Content } from './content'
import type { VerbSet } from './content/types'

const files = import.meta.glob<VerbSet>('../content/verbs/*.json', { eager: true, import: 'default' })
const verbSet: VerbSet = Object.values(files)[0]

export const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\s-]/gu, ' ').split(/\s+/).filter(Boolean)

const known = new Set<string>()
const add = (s: string) => {
  for (const w of words(s)) {
    known.add(stripAccents(w))
    for (const part of w.split('-')) if (part) known.add(stripAccents(part))
  }
}
/** Portuguese text sits under these keys in the content files. */
const PT_KEYS = new Set(['pt', 'answers', 'answer', 'forms', 'tiles'])
function walk(x: unknown, pt = false) {
  if (typeof x === 'string') { if (pt) add(x); return }
  if (Array.isArray(x)) { for (const y of x) walk(y, pt); return }
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) walk(v, PT_KEYS.has(k))
}
walk(a1Content)
walk(verbSet.verbs)
for (const p of ['eu', 'tu', 'ele', 'ela', 'você', 'nós', 'eles', 'elas', 'vocês', 'me', 'te', 'se', 'nos', 'lhe', 'o', 'a', 'os', 'as']) add(p)

/** A real word (accents ignored), so a "typo" that makes it is really a different word. */
export const isWord = (w: string) => known.has(stripAccents(w.toLowerCase()))

/** Subject pronoun → the person it takes in the verb tables (0 eu … 4 eles/elas/vocês). */
export const SUBJECTS: Record<string, number> = { eu: 0, tu: 1, ele: 2, ela: 2, 'você': 2, 'nós': 3, eles: 4, elas: 4, 'vocês': 4 }

/** Persons a verb form belongs to (e.g. "sou" → [0]); empty when it isn't in the tables. */
export function personsOf(form: string): number[] {
  const f = form.toLowerCase()
  const out = new Set<number>()
  for (const v of verbSet.verbs) v.forms.forEach((x, i) => { if (x === f) out.add(i) })
  return [...out]
}

const REFLEXIVE: Record<string, string> = { me: 'eu', te: 'tu', se: 'ele/ela/você', nos: 'nós' }

/** Why one real word in place of another is wrong, in a short line. */
export function explainSwap(typed: string, expected: string): string {
  const t = typed.toLowerCase(), e = expected.toLowerCase()
  for (const v of verbSet.verbs) {
    const i = v.forms.indexOf(t), j = v.forms.indexOf(e)
    if (i >= 0 && j >= 0) return `“${t}” is ${v.inf} for ${verbSet.persons[i]}. Here it’s “${e}” (${verbSet.persons[j]}).`
  }
  if (REFLEXIVE[t] && REFLEXIVE[e]) return `“${t}” goes with ${REFLEXIVE[t]}. Here it’s “${e}” (${REFLEXIVE[e]}).`
  return `“${t}” is a different word from “${e}”. One small change, a different meaning.`
}
