// Question pools for grammar topics and unit steps. Some topics add generated questions
// (articles from every noun you've met, numbers), so a round can be new every time.
import type { Exercise, GrammarTopic, Unit } from './content/types'
import { a1Content } from './content'
import { newRound } from './rounds'
import { shuffle, rng } from './test'

export const TOPIC_ROUND = 8 // questions per grammar topic practice
export const LESSON_PER_TOPIC = 5 // per topic in the Grammar step's own practice
export const EXERCISES_ROUND = 12
export const CHECK_ROUND = 10

const bare = (pt: string) => pt.replace(/^(o|a) /, '')
const article = (en: string) => (/^[aeiou]/i.test(en) ? 'an' : 'a')
const noThe = (en: string) => en.replace(/^the /, '').split(/[,;(]/)[0].trim()

/** o / a and um / uma for every singular noun with a gender, from this unit and the ones before. */
function genderQuestions(n: number): Exercise[] {
  const nouns = Object.values(a1Content).filter(u => u.n <= n).flatMap(u => u.vocab)
    .filter(v => v.gender && /^(o|a) /.test(v.pt) && !v.pt.includes(' / ') && !/^\p{Lu}/u.test(bare(v.pt))) // no names: a Alemanha
  return nouns.flatMap((v): Exercise[] => {
    const word = bare(v.pt)
    const m = v.gender === 'm'
    const the: Exercise = { id: `gen-${v.id}-o`, type: 'gap-fill', part: 'grammar', pt: `___ ${word}`, en: `the ${noThe(v.en)}`, answers: [m ? 'o' : 'a'], options: ['o', 'a'] }
    // Things you'd order also come as "Queria um… / uma…".
    if (!ORDER.has(word)) return [the]
    return [the, { id: `gen-${v.id}-um`, type: 'gap-fill', part: 'grammar', pt: `Queria ___ ${word}, por favor.`, en: `I'd like ${article(noThe(v.en))} ${noThe(v.en)}, please.`, answers: [m ? 'um' : 'uma'], options: ['um', 'uma'] }]
  })
}
const ORDER = new Set(['café', 'galão', 'meia de leite', 'chá', 'sumo de laranja', 'água', 'torrada', 'sandes', 'pastel de nata', 'bolo'])

// ---------- numbers ----------
const ONES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove']
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
/** 0–100 in European Portuguese (masculine: um, dois). */
export function numberWord(n: number): string {
  if (n === 100) return 'cem'
  if (n < 20) return ONES[n]
  const t = TENS[Math.floor(n / 10)], o = n % 10
  return o ? `${t} e ${ONES[o]}` : t
}
/** Brazilian spellings learners mix up. */
const BR: Record<number, string> = { 14: 'quatorze', 16: 'dezesseis', 17: 'dezessete', 19: 'dezenove' }

/** Numbers that are easy to confuse with another. */
const LOOKALIKE = (n: number) => {
  const near = [n + 10, n - 10, n % 10 * 10 + Math.floor(n / 10), n < 20 && n > 10 ? n - 10 : n + 1, n - 1]
  return [...new Set(near)].filter(x => x >= 0 && x <= 100 && x !== n)
}
const NUMBERS = [3, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 30, 33, 40, 44, 47, 50, 56, 60, 66, 70, 74, 77, 80, 88, 90, 95, 99, 100]

function numberQuestions(): Exercise[] {
  return NUMBERS.map((n, i): Exercise => {
    const rand = rng(n + 1)
    const others = shuffle(LOOKALIKE(n), rand).slice(0, 2)
    switch (i % 3) {
      case 0: {
        // Digits → word: wrong options are a look-alike number, or the Brazilian spelling.
        const wrong = [BR[n], ...others.map(numberWord)].filter(Boolean).slice(0, 2) as string[]
        const options = [numberWord(n), ...wrong]
        return { id: `num-${n}-word`, type: 'choose', part: 'grammar', prompt: `How do you say ${n} in Portugal?`, options, answer: 0 }
      }
      case 1: {
        const options = [String(n), ...others.map(String)]
        return { id: `num-${n}-read`, type: 'choose', part: 'grammar', prompt: `“${numberWord(n)}” is…`, options, answer: 0 }
      }
      default:
        return { id: `num-${n}-write`, type: 'translate', part: 'grammar', en: `${n} (write it as a word)`, answers: [numberWord(n)] }
    }
  })
}

const GENERATED: Record<string, (unit: Unit) => Exercise[]> = {
  'u2-t1': unit => genderQuestions(unit.n),
  'u3-t1': () => numberQuestions(),
}

/** Every question a topic can ask: the written ones plus any generated ones. */
export const topicPool = (unit: Unit, t: GrammarTopic): Exercise[] => [...t.exercises, ...(GENERATED[t.id]?.(unit) ?? [])]
export const topicRoundSize = (unit: Unit, t: GrammarTopic) => Math.min(TOPIC_ROUND, topicPool(unit, t).length)
export const topicRound = (unit: Unit, t: GrammarTopic) => newRound(topicPool(unit, t), TOPIC_ROUND)

/** The Grammar step's practice: a few questions from every topic, mixed. */
export const grammarLessonSize = (unit: Unit) => unit.grammar.topics.reduce((s, t) => s + Math.min(LESSON_PER_TOPIC, topicPool(unit, t).length), 0)
export async function grammarLessonRound(unit: Unit) {
  const parts = await Promise.all(unit.grammar.topics.map(t => newRound(topicPool(unit, t), LESSON_PER_TOPIC)))
  return shuffle(parts.flat(), rng(Date.now()))
}

/** The unit's Exercises and Check steps, as rounds from their pools. */
export const stepRoundSize = (unit: Unit, step: 'exercises' | 'check') =>
  Math.min(step === 'exercises' ? EXERCISES_ROUND : CHECK_ROUND, unit[step].length)
export const stepRound = (unit: Unit, step: 'exercises' | 'check') => newRound(unit[step], stepRoundSize(unit, step))
