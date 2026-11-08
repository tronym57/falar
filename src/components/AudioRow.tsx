import type { ReactNode } from 'react'
import { audio, useAudio } from '../audio'

/** A tappable row that plays its audio clip; shows a speaker while playing. */
export function AudioRow({ id, pt, en, extra }: { id: string; pt: string; en: string; extra?: ReactNode }) {
  const { playing } = useAudio()
  const on = playing === id
  return (
    <button className={'audio-row tap' + (on ? ' playing' : '')} onClick={() => audio.play(id)} aria-label={`Play: ${pt}`}>
      <span className="audio-icon" aria-hidden>{on ? '🔊' : '▶'}</span>
      <span className="audio-text">
        <span className="pt">{pt}</span>
        <span className="en">{en}</span>
        {extra}
      </span>
    </button>
  )
}

/** Toggle for 0.75× playback speed. */
export function SlowToggle() {
  const { slow } = useAudio()
  return (
    <button className={'chip tap' + (slow ? ' on' : '')} onClick={() => audio.setSlow(!slow)}>
      🐢 Slow {slow ? 'on' : 'off'}
    </button>
  )
}
