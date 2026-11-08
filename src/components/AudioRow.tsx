import type { ReactNode } from 'react'
import { audio, useAudio } from '../audio'

/** Play a clip: recorded audio, or the phone's voice for your own words (`tts`). */
export const playItem = (id: string, tts?: string) => (tts ? audio.speak(id, tts) : audio.play(id))

/** A tappable row that plays its audio clip; shows a speaker while playing. `aside` sits on the right (e.g. a status badge). */
export function AudioRow({ id, pt, en, extra, aside, tts }: { id: string; pt: string; en: string; extra?: ReactNode; aside?: ReactNode; tts?: boolean }) {
  const { playing } = useAudio()
  const on = playing === id
  return (
    <button className={'audio-row tap' + (on ? ' playing' : '')} onClick={() => playItem(id, tts ? pt : undefined)} aria-label={`Play: ${pt}`}>
      <span className="audio-icon" aria-hidden>{on ? '🔊' : '▶'}</span>
      <span className="audio-text">
        <span className="pt">{pt}</span>
        <span className="en">{en}</span>
        {extra}
      </span>
      {aside && <span className="audio-aside">{aside}</span>}
    </button>
  )
}

/** Toggle for 0.75× playback speed. */
export function SlowToggle() {
  const { slow } = useAudio()
  return (
    <button className={'btn btn-sm rounded-full ' + (slow ? 'btn-primary' : 'btn-soft')} onClick={() => audio.setSlow(!slow)}>
      🐢 Slow {slow ? 'on' : 'off'}
    </button>
  )
}
