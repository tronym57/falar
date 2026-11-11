"""Generate course audio with Microsoft's pt-PT neural voices (via edge-tts).

Reads the item list from `node scripts/content.mjs audio-items` on stdin and writes
public/audio/<id>.mp3. A manifest records a hash of voice + text per id, so only new or
changed lines are regenerated, and files for removed ids are deleted.

Run via: npm run audio
"""
import asyncio
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import edge_tts

VOICES = {"raquel": "pt-PT-RaquelNeural", "duarte": "pt-PT-DuarteNeural"}
# Duarte speaks fast and the start of a clip can get clipped on iOS: slower, with a little silence
# before and after (needs ffmpeg: brew install ffmpeg).
STYLE = {"duarte": {"rate": "-12%", "pad": (0.15, 0.25)}}
AUDIO_DIR = Path(__file__).resolve().parent.parent / "public" / "audio"
MANIFEST = AUDIO_DIR / "manifest.json"


def digest(item):
    style = STYLE.get(item["voice"])
    return hashlib.sha1(f"{item['voice']}|{item['text']}{'|' + json.dumps(style) if style else ''}".encode()).hexdigest()[:16]


def pad(path, before, after):
    tmp = path.with_suffix(".tmp.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-af",
                    f"adelay={int(before * 1000)},apad=pad_dur={after}", "-ar", "24000", "-ac", "1", "-b:a", "48k", str(tmp)], check=True)
    tmp.replace(path)


async def synth(item, path):
    # The free endpoint occasionally returns no audio; retry a few times.
    for attempt in range(5):
        try:
            style = STYLE.get(item["voice"], {})
            await edge_tts.Communicate(item["text"], VOICES[item["voice"]], rate=style.get("rate", "+0%")).save(str(path))
            if path.stat().st_size > 0:
                if "pad" in style:
                    pad(path, *style["pad"])
                return
        except edge_tts.exceptions.NoAudioReceived:
            pass
        await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError(f"No audio for {item['id']}: {item['text']!r}")


async def main():
    items = json.load(sys.stdin)
    if any(i["voice"] in STYLE for i in items) and not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is needed for the padded voices: brew install ffmpeg")
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}

    todo = [i for i in items if manifest.get(i["id"]) != digest(i) or not (AUDIO_DIR / f"{i['id']}.mp3").exists()]
    for n, item in enumerate(todo, 1):
        print(f"[{n}/{len(todo)}] {item['id']} ({item['voice']}): {item['text']}")
        await synth(item, AUDIO_DIR / f"{item['id']}.mp3")
        manifest[item["id"]] = digest(item)
        MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True))

    keep = {i["id"] for i in items}
    removed = [k for k in list(manifest) if k not in keep]
    for k in removed:
        (AUDIO_DIR / f"{k}.mp3").unlink(missing_ok=True)
        del manifest[k]
    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True))
    print(f"Done: {len(todo)} generated, {len(items) - len(todo)} unchanged, {len(removed)} removed.")


asyncio.run(main())
