# Falo Portuguese: UI styleguide

Built on daisyUI (Tailwind). Tokens live in `src/index.css` (`:root` + dark mode). Every new screen uses these, no one-off values.

## 1. Principles

1. **Content first, room to breathe.** Portuguese text is the hero. Generous spacing, one main action per screen.
2. **Hierarchy by size, then weight, then colour.** A reader should see title → section → item without reading.
3. **Green means "Portugal and progress"**, but in layers: strong green only for the single main action, tonal greens for everything secondary.
4. **Depth shows what's tappable.** Raised cards are tappable or grouped content; flat tinted panels are information.
5. **Every tap responds** (pressed state), nothing is silently disabled, errors are always visible.

## 2. Type scale (Open Sans)

| Role | Size / line-height | Weight | Use |
|---|---|---|---|
| **H1** page title | 32 / 1.15 | 700, -0.01em | One per screen ("Verbs", "0 · Survival kit") |
| **H2** section / card title | 22 / 1.25 | 700 | Cards, grammar topics, result blocks |
| **H3** sub-section | 18 / 1.3 | 600 | Inside cards: "Examples", rule titles |
| **Lesson text** (Portuguese) | 19 / 1.4 | 600 | Phrases, vocab, dialogue lines, forms |
| Body | 17 / 1.5 | 400 | Explanations, rules |
| Secondary | 15 / 1.45 | 400, muted | English translations, hints |
| Label | 13 / 1.3 | 700, caps, +0.06em | Section labels ("UNITS", "EXERCISE") |

Each step is at least 1.2× the next, so levels never blur together.

## 3. Spacing (4-pt grid)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48`

| Where | Value |
|---|---|
| Page side padding | 20 |
| Card padding | 20 |
| Gap between cards | 16 |
| Between sections (label → next block) | 32 |
| List rows (audio rows) | 14 vertical |
| Title → first content | 20 |
| Grammar topic → next topic | 48 |

## 4. Colour roles

**Green ramp** (light): 50 `#eef7f2` · 100 `#d7eee2` · 200 `#b0dcc6` · 300 `#80c4a3` · 400 `#4ea77f` · 500 `#2b8a62` · 600 `#177a55` · **700 `#0b6e4f`** · 800 `#0a553d` · 900 `#083f2e`

| Role | Light | Dark | Used for |
|---|---|---|---|
| **Primary** (filled) | green 700 | `#3fb68b` | The one main action per screen, selected chips, active progress |
| **Tonal** (bg / text) | green 100 / green 800 | `#16352a` / `#bfe8d3` | Secondary buttons, audio play icons, topic numbers, active tab pill |
| **Tint** | green 50 | `#13251e` | Rule panels, "playing" rows, pressed state |
| **Accent line** | green 500 | `#3a9c74` | Left bar on rule panels |
| **Hero gradient** | green 700 → 600 | `#1f6f52` → `#2a8c63` | Home "Continue" card only |
| Info (blue) | `#0b5cad` | `#5aa9f0` | "New" badges |
| Amber | `#b86e00` on `#fff6e0` | `#e3a33b` on `#2b2311` | Tips ("Watch out"), "Due" |
| Error (red) | `#c62828` | `#ef6b6b` | Wrong answers, errors, "Weak" |
| Success | `#1a7f37` | `#4cc26b` | Correct answers only |
| Flag stripe | green → red | same | Portugal-vs-Brazil notes |

Surfaces: page `#f3f5f2` / `#0f1312`, card `#ffffff` / `#182019`, raised hover `#f7f9f6` / `#1f2922`, border `#e3e8e4` / `#29332e`.

## 5. Depth

| Level | Style | Used for |
|---|---|---|
| 0 flat | page background | Screens |
| 1 card | 1px border + soft shadow `0 1px 2px / 0 4px 14px` (green-tinted) | Cards, lists, tappable rows |
| 2 hero | Gradient + stronger coloured shadow | Home "Continue" |
| Sticky | Translucent surface + blur | Header, tab bar, feedback bar |

## 6. Components

- **Buttons:** primary (filled green 700) for the main action; **tonal** (green 100) for secondary; ghost for back links and small actions. Height ≥ 48px, radius 12.
- **Chips:** unselected neutral soft; selected primary. Rounded full.
- **Audio rows:** tonal round play icon → turns primary while playing; Portuguese in lesson text, English in secondary; status badges aligned **right**.
- **Cards:** radius 18, padding 20, level-1 depth. Tappable cards get a chevron and a pressed state.
- **Panels:** rule = tint + green accent bar; tip = amber; Portugal-vs-Brazil = flag stripe.
- **Tab bar:** active tab shows a tonal pill behind the icon, green label.
