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
  // Listening comprehension: asked after hearing the whole conversation. Options are shuffled when shown.
  /** `lines`: the part of the conversation the question is about, as [first, last] line index (inclusive). */
  questions?: { id: string; q: string; options: string[]; answer: number; lines?: [number, number] }[]
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
export type Part = 'vocab' | 'listening' | 'grammar' | 'sentences' | 'verbs' | 'reading' | 'speaking'

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
  // Listening, generated from the recorded lines (not written in unit files):
  | { id: string; type: 'dictation'; audio: string; answers: string[] } // hear it, type it
  | { id: string; type: 'listen-pick'; audio: string; options: string[]; answer: number } // hear it, pick the Portuguese
  | { id: string; type: 'listen-gap'; audio: string; pt: string; answers: string[] } // hear it, type the missing word
  // Speaking: say it out loud, checked with speech recognition. `audio` = the model answer.
  // `cue`: role-play, the other person's line, played first.
  | { id: string; type: 'speak'; prompt: string; answers: string[]; pt: string; audio: string; cue?: { audio: string; pt: string; en: string; name: string } }
  // Reading: a question about a text, shown with the text above it.
  | { id: string; type: 'read-choose'; title: string; paragraphs: string[]; question: string; options: string[]; answer: number }
  | { id: string; type: 'listen-dialogue'; clips: string[]; title: string; lines: { name: string; pt: string }[]; question: string; options: string[]; answer: number }
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
/** `unit`: the unit that teaches the verb (finishing its Key phrases opens it in the trainer). */
export type Verb = { id: string; inf: string; en: string; kind: string; unit: number; forms: string[]; note?: string; examples: VerbExample[] }
export type VerbSet = { id: string; level: string; tense: string; title: string; persons: string[]; verbs: Verb[] }

/** A reading text, content/reading/a1-*.json. Every word has a meaning in its glossary or the shared one. */
export type ReadingText = {
  id: string
  order: number // list position, easiest first
  level: 'A1' | 'A1+' // A1+ = has a few A2 structures, explained in `notes`
  after: number // best read after this unit (-1: not tied to a unit, e.g. AI texts)
  tts?: boolean // no recorded audio: read aloud with the phone's voice (AI texts)
  emoji: string
  title: string
  en: string
  paragraphs: { id: string; pt: string; en: string }[] // each paragraph has audio: public/audio/<id>.mp3
  questions: { id: string; q: string; options: string[]; answer: number }[] // options shuffled when shown
  glossary: Record<string, string>
  notes?: { pt: string; en: string }[] // "Phrases to notice": multi-word bits single-word meanings can't explain
}
