import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from './screens/Home'
import Course from './screens/Course'
import Vocab from './screens/Vocab'
import Settings from './screens/Settings'
import Unit from './screens/Unit'
import UnitStep, { LessonRunner } from './screens/UnitStep'
import Review from './screens/Review'
import PracticeHub, { GrammarDrill, GrammarReference, GrammarTopicScreen, TestRunner } from './screens/PracticeTab'
import VerbTrainer, { DrillRunner, VerbScreen } from './screens/Verbs'
import ReadingList, { ReadingQuestions, ReadingTextScreen } from './screens/Reading'
import { syncCards } from './review'
import { audio } from './audio'
import { useToast } from './toast'
import { registerSW } from 'virtual:pwa-register'
import { MotionConfig, motion } from 'motion/react'
import { hasLocalData, startAutoBackup } from './backup'
import { Welcome } from './components/Backup'
import { LAST_ROUTE, kv } from './kv'

const tabs = [
  { to: '/', label: 'Home', icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/course', label: 'Course', icon: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7" /> },
  { to: '/practice', label: 'Practice', icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></> },
  { to: '/vocab', label: 'Vocab', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { to: '/settings', label: 'Settings', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></> },
]

// Full-screen modes (exercises, tests, review) hide the header and tab bar.
const IMMERSIVE = /^\/(unit\/\d+\/(exercises|check|[a-z]+\/practice)|review|practice\/test|drill\/.*|reading\/[^/]+\/questions)$/

export default function App() {
  const { pathname } = useLocation()
  const toast = useToast()
  useEffect(() => {
    registerSW({
      immediate: true,
      // iOS resumes home-screen apps instead of restarting them, so a check on start alone isn't enough:
      // also look for a new version whenever the app comes back to the foreground, and every 30 minutes.
      onRegisteredSW: (_url, reg) => {
        if (!reg) return
        const check = () => { if (navigator.onLine) reg.update().catch(() => {}) }
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
        setInterval(check, 30 * 60_000)
      },
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
  // Remember where you are, so reopening the app lands on the same screen (see main.tsx).
  useEffect(() => { kv.set(LAST_ROUTE, pathname) }, [pathname])
  useEffect(() => audio.onError(() => toast("Couldn't play this audio. If you're offline, open the app once with a connection.", 'error')), [toast])
  if (welcome === null) return null
  if (welcome) return <Welcome onDone={() => { kv.set('falar.onboarded', '1'); setWelcome(false) }} />

  const immersive = IMMERSIVE.test(pathname)
  return (
    // reducedMotion="user": no movement when iOS "Reduce Motion" is on.
    <MotionConfig reducedMotion="user">
      {!immersive && (
        <header className="navbar appbar">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={28} height={28} />
          <span>Falo Portuguese</span>
        </header>
      )}
      {/* Each screen fades and rises in. Ends at transform: none, so fixed panels inside still work. */}
      <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/course" element={<Course />} />
        <Route path="/vocab" element={<Vocab />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/unit/:n" element={<Unit />} />
        <Route path="/unit/:n/:step" element={<UnitStep />} />
        <Route path="/unit/:n/:step/practice" element={<LessonRunner />} />
        <Route path="/review" element={<Review />} />
        <Route path="/practice" element={<PracticeHub />} />
        <Route path="/practice/test" element={<TestRunner />} />
        <Route path="/practice/grammar" element={<GrammarReference />} />
        <Route path="/grammar/:n/:topic" element={<GrammarTopicScreen />} />
        <Route path="/drill/grammar/:n/:topic" element={<GrammarDrill />} />
        <Route path="/practice/verbs" element={<VerbTrainer />} />
        <Route path="/verbs/:id" element={<VerbScreen />} />
        <Route path="/drill/run/:key" element={<DrillRunner />} />
        <Route path="/reading" element={<ReadingList />} />
        <Route path="/reading/:id" element={<ReadingTextScreen />} />
        <Route path="/reading/:id/questions" element={<ReadingQuestions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </motion.div>
      {!immersive && <nav className="dock">
        {tabs.map(t => {
          // Inside a unit, keep the Course tab highlighted; same for Practice sub-screens.
          const active = pathname === t.to || (t.to === '/course' && pathname.startsWith('/unit/')) || (t.to === '/practice' && /^\/(practice\/|grammar\/|verbs\/|reading)/.test(pathname))
          return (
          <NavLink key={t.to} to={t.to} end className={active ? 'dock-active' : ''}>
            <span className="dock-icon">
              {active && <motion.span layoutId="dock-pill" className="dock-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
            </span>
            <span className="dock-label">{t.label}</span>
          </NavLink>
          )
        })}
      </nav>}
    </MotionConfig>
  )
}
