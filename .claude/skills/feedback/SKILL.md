---
name: feedback
description: Read and work through feedback Patrick sent from the Falo Português app (the ✎ tab on the right edge of every screen), each with a screenshot and what was on screen. Use when he says /feedback, "check my feedback", or when a session starts on this app.
---

# Feedback from the app

1. Download the open items:
   ```bash
   node scripts/feedback.mjs list
   ```
   Each item prints its id, screen (route, exercise and session ids), app version, note and the paths to `screenshot.jpg` and `note.json` (in `.feedback/<id>/`, git-ignored).
2. For each item, Read the screenshot (it's an image: look at it) and `note.json`. `context.text` is the screen's text, `context.scrollY` where he was, `context.dark` the theme. The screenshot is drawn from the page, so a blur or animation can look a bit off; trust the note and context over small rendering differences.
3. Show Patrick a short list (one line each: screen → what he asked) and say which you'll do. Ask only if a note is unclear or two notes conflict.
4. Make each change the usual way for this app: tests, build, check the screen in the preview (open it at `#<route>`), deploy.
5. Mark each item done with what changed and the commit:
   ```bash
   node scripts/feedback.mjs done <id> "<what changed> (<short sha>)"
   ```
   This removes the picture from the Gist; the local copy stays in `.feedback/`.
