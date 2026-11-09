import { useEffect, useState } from 'react'
import { BackupSettings } from '../components/Backup'
import { AiSettings, NameSetting } from '../components/AiSetup'
import { getMode, setMode, type Mode } from '../theme'
import { chimeOn, playChime, setChimeOn } from '../chime'

const MODES: { id: Mode; label: string }[] = [{ id: 'light', label: 'Standard' }, { id: 'dark', label: 'Dark' }, { id: 'auto', label: 'Like iPhone' }]

export default function Settings() {
  const [online, setOnline] = useState(navigator.onLine)
  const [mode, setModeState] = useState(getMode)
  const [chime, setChime] = useState(chimeOn)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    addEventListener('online', update)
    addEventListener('offline', update)
    return () => { removeEventListener('online', update); removeEventListener('offline', update) }
  }, [])

  return (
    <main className="screen">
      <h1>Settings</h1>
      <div className="card">
        <div className="row"><span>Connection</span><span className="muted">{online ? 'Online' : 'Offline ✓ app still works'}</span></div>
        <div className="row"><span>Version</span><span className="muted">{__APP_VERSION__}</span></div>
      </div>
      <p className="section-label">Look &amp; sound</p>
      <div className="card">
        <div className="row"><span>Mode</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Mode">
            {MODES.map(m => (
              <button key={m.id} role="radio" aria-checked={mode === m.id}
                className={'btn btn-sm rounded-full ' + (mode === m.id ? 'btn-primary' : 'btn-soft')}
                onClick={() => { setMode(m.id); setModeState(m.id) }}>{m.label}</button>
            ))}
          </div>
        </div>
        <label className="row" style={{ cursor: 'pointer' }}>
          <span>Sound for a correct answer</span>
          <input type="checkbox" className="toggle toggle-primary" checked={chime}
            onChange={e => { setChimeOn(e.target.checked); setChime(e.target.checked); if (e.target.checked) playChime() }} />
        </label>
      </div>
      <p className="section-label">You</p>
      <NameSetting />
      <BackupSettings />
      <p className="section-label">Conversation partner</p>
      <AiSettings />
    </main>
  )
}
