#!/usr/bin/env node
// Content tooling for content/<level>/*.json.
//   node scripts/content.mjs lint          check shape, ids, Brazilian forms and audio files
//   node scripts/content.mjs lint --no-audio   same, but skip the audio-file check
//   node scripts/content.mjs audio-items   print [{id, text, voice}] for the audio generator
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'content')
const audioDir = join(root, 'public', 'audio')

// ---------- Brazilian Portuguese markers ----------
// Words/forms that are Brazilian (or Brazilian spelling) where Portugal uses something else.
const BP_WORDS = {
  'ônibus': 'autocarro', onibus: 'autocarro', celular: 'telemóvel', trem: 'comboio',
  banheiro: 'casa de banho', 'café da manhã': 'pequeno-almoço', geladeira: 'frigorífico',
  sorvete: 'gelado', suco: 'sumo', 'xícara': 'chávena', 'aeromoça': 'hospedeira',
  'metrô': 'metro', 'pedágio': 'portagem', 'esporte': 'desporto', 'registro': 'registo',
  'econômico': 'económico', 'gênero': 'género', 'tênis': 'ténis', 'bebê': 'bebé',
  'antônio': 'António', 'fenômeno': 'fenómeno', 'acadêmico': 'académico',
  'oi': 'olá', 'a gente': 'nós (a gente is informal/Brazilian-leaning)', 'moça': 'rapariga / menina',
  garoto: 'miúdo / rapaz', 'pois não': '(Brazilian "how can I help?")', legal: 'fixe (if meaning "cool")',
  entendi: 'percebi',
}
const GERUND_AFTER_ESTAR = /\b(estou|estás|está|estamos|estão|estava|estavam)\s+\p{L}+ndo\b/iu
// A clitic pronoun at the very start of a sentence: "Me chamo" (Portugal: "Chamo-me").
const SENTENCE_INITIAL_CLITIC = /(^|[.!?…]\s+|["“]\s*)(me|te|se|nos|lhe|lhes)\s+\p{L}+/iu

function bpProblems(text) {
  const problems = []
  const lower = text.toLowerCase()
  for (const [word, pt] of Object.entries(BP_WORDS)) {
    const re = new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu')
    if (re.test(lower)) problems.push(`Brazilian "${word}" → use ${pt}`)
  }
  if (GERUND_AFTER_ESTAR.test(text)) problems.push('estar + gerund (-ndo) → use "estar a + infinitive"')
  if (SENTENCE_INITIAL_CLITIC.test(text)) problems.push('pronoun before the verb at sentence start → "Chamo-me", not "Me chamo"')
  return problems
}

// ---------- loading ----------
function loadUnits() {
  const units = []
  for (const level of readdirSync(contentDir).sort()) {
    const dir = join(contentDir, level)
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
      const path = join(dir, file)
      let data
      try { data = JSON.parse(readFileSync(path, 'utf8')) } catch (e) { units.push({ path, parseError: e.message }); continue }
      units.push({ path, data })
    }
  }
  return units
}

/** Every Portuguese string that gets an audio file, with the voice to use. */
function audioItems(u) {
  const items = []
  for (const d of u.dialogues ?? []) {
    for (const l of d.lines ?? []) items.push({ id: l.id, text: l.pt, voice: d.speakers?.[l.speaker]?.voice ?? 'raquel' })
  }
  for (const p of u.phrases ?? []) items.push({ id: p.id, text: p.pt, voice: 'raquel' })
  for (const v of u.vocab ?? []) items.push({ id: v.id, text: v.pt, voice: 'raquel' })
  for (const g of u.grammar?.examples ?? []) items.push({ id: g.id, text: g.pt, voice: 'raquel' })
  for (const x of [...(u.exercises ?? []), ...(u.check ?? [])]) {
    if (x.type === 'listen-choose') items.push({ id: x.id, text: x.pt, voice: 'raquel' })
  }
  for (const s of u.speaking ?? []) items.push({ id: s.id, text: s.pt, voice: 'raquel' })
  return items
}

// ---------- validation ----------
const words = s => s.split(/\s+/).map(w => w.replace(/[^\p{L}-]/gu, '').toLowerCase()).filter(Boolean)

function validate(u, errors, seenIds) {
  const err = (where, msg) => errors.push(`${u.id ?? '?'} ${where}: ${msg}`)
  const str = (v, where) => { if (typeof v !== 'string' || !v.trim()) err(where, 'missing text') }
  const id = (v, where) => {
    if (typeof v !== 'string' || !/^[a-z0-9-]+$/.test(v)) return err(where, `bad id "${v}"`)
    if (seenIds.has(v)) err(where, `duplicate id "${v}" (also in ${seenIds.get(v)})`)
    seenIds.set(v, u.id)
  }
  const pt = (text, where) => { str(text, where); for (const p of bpProblems(text ?? '')) err(where, p) }

  for (const k of ['id', 'title', 'scene']) str(u[k], k)
  if (!Number.isInteger(u.n)) err('n', 'must be a whole number')

  if (!Array.isArray(u.dialogues) || !u.dialogues.length) err('dialogues', 'needs at least one dialogue')
  for (const [di, d] of (u.dialogues ?? []).entries()) {
    str(d.title, `dialogue ${di + 1} title`); str(d.en, `dialogue ${di + 1} en`)
    for (const [k, s] of Object.entries(d.speakers ?? {})) {
      if (!['raquel', 'duarte'].includes(s.voice)) err(`dialogue ${di + 1} speaker ${k}`, `unknown voice "${s.voice}"`)
    }
    for (const l of d.lines ?? []) {
      id(l.id, `line`); pt(l.pt, l.id); str(l.en, `${l.id} en`)
      if (!d.speakers?.[l.speaker]) err(l.id, `unknown speaker "${l.speaker}"`)
    }
  }
  for (const p of u.phrases ?? []) { id(p.id, 'phrase'); pt(p.pt, p.id); str(p.en, `${p.id} en`) }
  for (const v of u.vocab ?? []) {
    id(v.id, 'vocab'); pt(v.pt, v.id); str(v.en, `${v.id} en`)
    if (v.gender && !['m', 'f'].includes(v.gender)) err(v.id, 'gender must be "m" or "f"')
    if (v.gender === 'm' && !/^(o|os|um) /.test(v.pt)) err(v.id, 'masculine noun should start with "o"')
    if (v.gender === 'f' && !/^(a|as|uma) /.test(v.pt)) err(v.id, 'feminine noun should start with "a"')
  }
  if (!u.grammar) err('grammar', 'missing')
  else {
    str(u.grammar.title, 'grammar title')
    if (!u.grammar.body?.length) err('grammar', 'body is empty')
    for (const g of u.grammar.examples ?? []) { id(g.id, 'grammar example'); pt(g.pt, g.id); str(g.en, `${g.id} en`) }
  }

  for (const x of [...(u.exercises ?? []), ...(u.check ?? [])]) {
    id(x.id, 'exercise')
    switch (x.type) {
      case 'listen-choose':
      case 'choose':
        if (x.type === 'listen-choose') pt(x.pt, x.id); else str(x.prompt, `${x.id} prompt`)
        if (!Array.isArray(x.options) || x.options.length < 2) err(x.id, 'needs at least 2 options')
        else if (!(x.answer >= 0 && x.answer < x.options.length)) err(x.id, 'answer index out of range')
        if (x.type === 'choose') for (const o of x.options ?? []) for (const p of bpProblems(o)) err(x.id, p)
        break
      case 'gap-fill':
        pt(x.pt, x.id); str(x.en, `${x.id} en`)
        if (!x.pt?.includes('___')) err(x.id, 'gap-fill text needs "___"')
        if (!x.answers?.length) err(x.id, 'needs answers')
        if (x.options && !x.answers?.some(a => x.options.includes(a))) err(x.id, 'no correct answer among the options')
        break
      case 'sentence-builder': {
        str(x.en, `${x.id} en`); pt(x.answer, x.id)
        const tiles = (x.tiles ?? []).map(t => t.toLowerCase())
        for (const w of words(x.answer ?? '')) if (!tiles.includes(w)) err(x.id, `answer word "${w}" is not a tile`)
        break
      }
      case 'translate':
        str(x.en, `${x.id} en`)
        if (!x.answers?.length) err(x.id, 'needs answers')
        for (const a of x.answers ?? []) pt(a, x.id)
        break
      case 'conjugation':
        str(x.verb, `${x.id} verb`); str(x.person, `${x.id} person`)
        if (!x.answers?.length) err(x.id, 'needs answers')
        break
      default:
        err(x.id, `unknown exercise type "${x.type}"`)
    }
  }
  for (const s of u.speaking ?? []) {
    id(s.id, 'speaking'); str(s.prompt, `${s.id} prompt`); pt(s.pt, s.id)
    if (!s.answers?.length) err(s.id, 'needs answers')
    for (const a of s.answers ?? []) pt(a, s.id)
  }
  if (!u.check?.length) err('check', 'unit check is empty')
}

// ---------- commands ----------
const [cmd, ...flags] = process.argv.slice(2)
const units = loadUnits()

if (cmd === 'audio-items') {
  process.stdout.write(JSON.stringify(units.filter(u => u.data).flatMap(u => audioItems(u.data)), null, 1))
} else if (cmd === 'lint') {
  const errors = []
  const seenIds = new Map()
  for (const u of units) {
    if (u.parseError) { errors.push(`${u.path}: invalid JSON: ${u.parseError}`); continue }
    validate(u.data, errors, seenIds)
    if (!flags.includes('--no-audio')) {
      for (const a of audioItems(u.data)) {
        if (a.id && !existsSync(join(audioDir, `${a.id}.mp3`))) errors.push(`${u.data.id} ${a.id}: audio file missing (run npm run audio)`)
      }
    }
  }
  if (errors.length) {
    console.error(errors.map(e => '✗ ' + e).join('\n'))
    console.error(`\n${errors.length} problem(s) in ${units.length} unit file(s).`)
    process.exit(1)
  }
  const n = units.reduce((s, u) => s + audioItems(u.data).length, 0)
  console.log(`✓ ${units.length} unit file(s) OK, ${n} audio items.`)
} else {
  console.error('Usage: node scripts/content.mjs lint [--no-audio] | audio-items')
  process.exit(2)
}
