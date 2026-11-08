"""Generate course audio with Microsoft's pt-PT neural voices (via edge-tts).

Reads the item list from `node scripts/content.mjs audio-items` on stdin and writes
public/audio/<id>.mp3. A manifest records a hash of voice + text per id, so only new or
changed lines are regenerated, and files for removed ids are deleted.

Run via: npm run audio
"""
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import edge_tts

VOICES = {"raquel": "pt-PT-RaquelNeural", "duarte": "pt-PT-DuarteNeural"}
AUDIO_DIR = Path(__file__).resolve().parent.parent / "public" / "audio"
MANIFEST = AUDIO_DIR / "manifest.json"


def digest(item):
    return hashlib.sha1(f"{item['voice']}|{item['text']}".encode()).hexdigest()[:16]


async def synth(item, path):
    # The free endpoint occasionally returns no audio; retry a few times.
    for attempt in range(5):
        try:
            await edge_tts.Communicate(item["text"], VOICES[item["voice"]]).save(str(path))
            if path.stat().st_size > 0:
                return
        except edge_tts.exceptions.NoAudioReceived:
            pass
        await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError(f"No audio for {item['id']}: {item['text']!r}")


async def main():
    items = json.load(sys.stdin)
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
