import { useEffect, useState } from 'react'
import { BackupSettings } from '../components/Backup'

export default function Settings() {
  const [online, setOnline] = useState(navigator.onLine)
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
      <BackupSettings />
    </main>
  )
}
