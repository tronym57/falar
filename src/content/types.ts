// Shape of a unit file in content/<level>/unit-NN-*.json.
// Every item with an `id` and `pt` text gets a pre-generated audio file: public/audio/<id>.mp3.
// scripts/content.mjs validates this shape; keep the two in sync.

export type Voice = 'raquel' | 'duarte'

export type Line = { id: string; speaker: string; pt: string; en: string }

export type Dialogue = {
  title: string
  en: string
  speakers: Record<string, { name: string; voice: Voice }>
  lines: Line[]
}

export type Phrase = { id: string; pt: string; en: string; note?: string }

export type VocabItem = { id: string; pt: string; en: string; gender?: 'm' | 'f'; note?: string }

export type Grammar = {
  title: string
  body: string[]
  examples: Phrase[]
  epNote?: string
}

/** Answers are compared loosely: case, punctuation and accents are ignored. */
export type Exercise =
  | { id: string; type: 'listen-choose'; pt: string; options: string[]; answer: number }
  | { id: string; type: 'choose'; prompt: string; options: string[]; answer: number }
  | { id: string; type: 'gap-fill'; pt: string; en: string; answers: string[]; options?: string[] }
  | { id: string; type: 'sentence-builder'; en: string; tiles: string[]; answer: string }
  | { id: string; type: 'translate'; en: string; answers: string[] }
  | { id: string; type: 'conjugation'; verb: string; person: string; answers: string[] }

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
