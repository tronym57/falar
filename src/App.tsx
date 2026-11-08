import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from './screens/Home'
import Course from './screens/Course'
import Vocab from './screens/Vocab'
import Settings from './screens/Settings'
import Unit from './screens/Unit'
import UnitStep from './screens/UnitStep'
import Review from './screens/Review'
import PracticeHub, { GrammarDrill, GrammarReference, GrammarTopicScreen, TestRunner } from './screens/PracticeTab'
import { syncCards } from './review'
import { audio } from './audio'
import { useToast } from './toast'
import { registerSW } from 'virtual:pwa-register'
import { hasLocalData, startAutoBackup } from './backup'
import { Welcome } from './components/Backup'
import { kv } from './kv'

const tabs = [
  { to: '/', label: 'Home', icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/course', label: 'Course', icon: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7" /> },
  { to: '/practice', label: 'Practice', icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></> },
  { to: '/vocab', label: 'Vocab', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { to: '/settings', label: 'Settings', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></> },
]

// Full-screen modes (exercises, tests, review) hide the header and tab bar.
const IMMERSIVE = /^\/(unit\/\d+\/(exercises|check)|review|practice\/test|drill\/.*)$/

export default function App() {
  const { pathname } = useLocation()
  const toast = useToast()
  useEffect(() => {
    registerSW({
      immediate: true,
      onRegisterError: () => toast("Offline mode isn't available in this browser. The app still works while you're online."),
    })
  }, [toast])
  // Catch up on review cards for steps finished before this version.
  useEffect(() => { syncCards().catch(e => toast(`Couldn't update your review cards: ${e.message}`, 'error')) }, [toast])
  // First launch with no data (new install or reinstalled): offer restore before anything else.
  const [welcome, setWelcome] = useState<boolean | null>(kv.get('falar.onboarded') ? false : null)
  useEffect(() => {
    if (welcome !== null) return
    hasLocalData().then(has => { if (has) kv.set('falar.onboarded', '1'); setWelcome(!has) }).catch(() => setWelcome(false))
  }, [welcome])
  useEffect(() => { startAutoBackup() }, [])
  useEffect(() => audio.onError(() => toast("Couldn't play this audio. If you're offline, open the app once with a connection.", 'error')), [toast])
  if (welcome === null) return null
  if (welcome) return <Welcome onDone={() => { kv.set('falar.onboarded', '1'); setWelcome(false) }} />

  const immersive = IMMERSIVE.test(pathname)
  return (
    <>
      {!immersive && (
        <header className="navbar appbar">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={28} height={28} />
          <span>Falo Portuguese</span>
        </header>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/course" element={<Course />} />
        <Route path="/vocab" element={<Vocab />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/unit/:n" element={<Unit />} />
        <Route path="/unit/:n/:step" element={<UnitStep />} />
        <Route path="/review" element={<Review />} />
        <Route path="/practice" element={<PracticeHub />} />
        <Route path="/practice/test" element={<TestRunner />} />
        <Route path="/practice/grammar" element={<GrammarReference />} />
        <Route path="/grammar/:n/:topic" element={<GrammarTopicScreen />} />
        <Route path="/drill/grammar/:n/:topic" element={<GrammarDrill />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!immersive && <nav className="dock">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            // Inside a unit, keep the Course tab highlighted.
            className={({ isActive }) => (isActive || (t.to === '/course' && pathname.startsWith('/unit/')) || (t.to === '/practice' && /^\/(practice|grammar)\//.test(pathname)) ? 'dock-active' : '')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
            <span className="dock-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>}
    </>
  )
}
