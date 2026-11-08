// Shape of a unit file in content/<level>/unit-NN-*.json.
// Every item with an `id` and `pt` text gets a pre-generated audio file: public/audio/<id>.mp3.
// scripts/content.mjs validates this shape; keep the two in sync.

export type Voice = 'raquel' | 'duarte'

export type Line = { id: string; speaker: string; pt: string; en: string }

export type Dialogue = {
  title: string
  en: string
  // `me`: the learner's own lines (shown on the right, like your messages in a chat).
  speakers: Record<string, { name: string; voice: Voice; me?: boolean }>
  lines: Line[]
}

export type Phrase = { id: string; pt: string; en: string; note?: string }

export type VocabItem = { id: string; pt: string; en: string; gender?: 'm' | 'f'; note?: string }

/** One building block of a grammar topic. */
export type GrammarSection =
  | { type: 'rule'; title?: string; text: string }
  | { type: 'table'; caption?: string; head: string[]; rows: string[][] }
  | { type: 'examples'; items: Phrase[] }
  | { type: 'tip'; text: string }
  | { type: 'ep-note'; text: string }

export type GrammarTopic = { id: string; title: string; sections: GrammarSection[]; exercises: Exercise[] }

export type Grammar = { topics: GrammarTopic[] }

/** Which skill an exercise trains; used to score mixed tests per part. */
export type Part = 'vocab' | 'listening' | 'grammar' | 'sentences' | 'verbs'

/** Answers are compared loosely: case, punctuation and accents are ignored. */
export type Exercise = ({ part?: Part } & (
  // `audio`: id of the clip to play (defaults to the exercise id).
  | { id: string; type: 'listen-choose'; pt: string; options: string[]; answer: number; audio?: string }
  | { id: string; type: 'choose'; prompt: string; options: string[]; answer: number }
  | { id: string; type: 'gap-fill'; pt: string; en: string; answers: string[]; options?: string[] }
  | { id: string; type: 'sentence-builder'; en: string; tiles: string[]; answer: string }
  | { id: string; type: 'translate'; en: string; answers: string[] }
  | { id: string; type: 'conjugation'; verb: string; person: string; answers: string[] }
  | { id: string; type: 'verb-table'; verb: string; persons: string[]; answers: string[] }
))

export type SpeakingPrompt = { id: string; prompt: string; answers: string[]; pt: string }

export type Unit = {
  id: string
  n: number
  title: string
  scene: string
  dialogues: Dialogue[]
  phrases: Phrase[]
  vocab: VocabItem[]
  grammar: Grammar
  exercises: Exercise[]
  speaking: SpeakingPrompt[]
  check: Exercise[]
}

/** A verb set, e.g. content/verbs/a1-present.json. */
export type VerbExample = { id: string; pt: string; en: string; person: number }
export type Verb = { id: string; inf: string; en: string; kind: string; forms: string[]; note?: string; examples: VerbExample[] }
export type VerbSet = { id: string; level: string; tense: string; title: string; persons: string[]; verbs: Verb[] }
