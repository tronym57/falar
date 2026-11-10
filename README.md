# Falo Portuguese

A small, personal web app (PWA) for learning **European Portuguese**: Portugal, never Brazil. It is built for an iPhone, works offline, and focuses on speaking in everyday situations on the Silver Coast (Peniche, Ferrel).

**Live:** https://tronym57.github.io/falar/. On an iPhone, open it in Safari and choose *Share → Add to Home Screen*.

## What's in it

- **Course (A1).** Units 0–3 are built so far: Survival kit, Meeting people, Café / pastelaria, and Numbers & money. Each unit follows the same steps: dialogues, key phrases, vocabulary, grammar (each topic has its own practice), exercises, speaking, and an end-of-unit check.
- **Daily review.** Spaced repetition with FSRS covers every phrase and word you've learned, plus words you add yourself.
- **Practice.** Verb drills (present tense), look-alikes (words that differ only by an accent, like *avó / avô*), listening practice, and a grammar reference.
- **Reading.** Short A1 texts about the area with a meaning for every word. Optionally, AI can write new texts on any topic.
- **Talk.** An optional AI conversation partner for role-play scenes. It needs your own Gemini API key.
- **Audio.** Every Portuguese line has a recorded pt-PT neural voice and a slow mode. Speaking exercises use the browser's speech recognition (pt-PT).
- **Backup.** Export to a JSON file, or sync automatically to a private GitHub Gist with your own token.

Progress is stored only on the device, in IndexedDB. API keys and tokens are entered in Settings and stay on the device: they are never in the code or the backup. Text you send to Gemini goes to Google.

## Stack

Vite, React 19, TypeScript, React Router (hash routing), Dexie (IndexedDB), ts-fsrs, Tailwind 4 with daisyUI, Motion, vite-plugin-pwa, and Vitest.

## Development

```bash
npm install
npm run dev            # local dev server
npm test               # unit tests (Vitest)
npm run lint           # oxlint
npm run lint:content   # validate course content (structure, ids, no Brazilian forms)
npm run build          # type-check and build into dist/
```

### Content

All course content is JSON in `content/`:

| Folder | What |
|---|---|
| `a1/` | One file per unit |
| `verbs/` | Verb tables and drills |
| `lookalikes/` | Accent pairs with examples |
| `reading/` | Reading texts and glossary |
| `talk/` | Conversation scenes |

`npm run lint:content` checks the content, including flagging Brazilian words and forms (`src/bp.ts`).

### Audio

Audio is generated with Microsoft's pt-PT neural voices via [edge-tts](https://github.com/rany2/edge-tts) and stored in `public/audio/`. Only new or changed lines are regenerated.

```bash
npm run audio:setup    # once: Python venv with edge-tts
npm run audio          # generate missing/changed clips
```

### Design

UI rules (type scale, spacing, colours, components) are in [`STYLEGUIDE.md`](STYLEGUIDE.md).

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) lints, tests, builds with `BASE=/falar/`, and publishes to GitHub Pages. To run it manually:

```bash
gh workflow run deploy.yml --ref main
```
