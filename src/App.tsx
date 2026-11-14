import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
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
import TalkList, { TalkChat } from './screens/Talk'
import LookAlikes from './screens/LookAlikes'
import { syncCards } from './review'
import { audio } from './audio'
import { useToast } from './toast'
import { registerSW } from 'virtual:pwa-register'
import { MotionConfig, motion } from 'motion/react'
import { hasLocalData, startAutoBackup } from './backup'
import { Welcome } from './components/Backup'
import Ask from './screens/Ask'
import { LAST_ROUTE, kv } from './kv'

const tabs = [
  { to: '/', label: 'Home', icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/course', label: 'Course', icon: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7" /> },
  { to: '/practice', label: 'Practice', icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></> },
  { to: '/vocab', label: 'Vocab', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { to: '/settings', label: 'Settings', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></> },
]

/** The tab a screen belongs to (the Course tab owns the units, Practice its sub-screens). */
function tabOf(path: string) {
  if (path === '/course' || path.startsWith('/unit/')) return '/course'
  if (/^\/(practice|grammar|verbs|reading|talk|drill)(\/|$)/.test(path)) return '/practice'
  return tabs.some(t => t.to === path) ? path : null
}

// Full-screen modes (exercises, tests, review) hide the header and tab bar.
const IMMERSIVE = /^\/(unit\/\d+\/(exercises|check|[a-z]+\/practice|grammar\/[^/]+\/practice)|review|practice\/test|drill\/.*|reading\/[^/]+\/questions|talk\/[^/]+)$/

export default function App() {
  const { pathname, search } = useLocation()
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
  // A new screen opens at the top; going back (POP) keeps the browser's restored position.
  // Only a deliberate jump target (`?at=…`, e.g. back to the next grammar topic) may land lower.
  // Reset before paint, and once more after it: iOS can apply a leftover scroll after the first reset.
  const navType = useNavigationType()
  const jump = new URLSearchParams(search).has('at')
  useLayoutEffect(() => {
    if (navType === 'POP' || jump) return
    window.scrollTo(0, 0)
    const f = requestAnimationFrame(() => window.scrollTo(0, 0))
    return () => cancelAnimationFrame(f)
  }, [pathname, navType, jump])
  // Remember where you are, so reopening the app lands on the same screen (see main.tsx).
  useEffect(() => { kv.set(LAST_ROUTE, pathname) }, [pathname])
  // Each tab remembers its last screen, so switching tabs and back returns there (like iOS apps).
  // Full-screen practice isn't remembered: you come back to the screen you started it from.
  const lastIn = useRef<Record<string, string>>({})
  useEffect(() => {
    const tab = tabOf(pathname)
    if (tab && !IMMERSIVE.test(pathname)) lastIn.current[tab] = pathname
  }, [pathname])
  useEffect(() => audio.onError(() => toast("Couldn't play this audio. If you're offline, open the app once with a connection.", 'error')), [toast])
  if (welcome === null) return null
  if (welcome) return <Welcome onDone={() => { kv.set('falar.onboarded', '1'); setWelcome(false) }} />

  const immersive = IMMERSIVE.test(pathname)
  return (
    // reducedMotion="user": no movement when iOS "Reduce Motion" is on.
    <MotionConfig reducedMotion="user">
      {!immersive && (
        <header className="navbar appbar">
          <Link to="/" className="appbar-home" aria-label="Falo Português, go to Home">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={28} height={28} />
            <span>Falo Português</span>
          </Link>
          <Link to="/ask" className="appbar-ask" aria-label="Ask what to say">💬 Ask</Link>
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
        <Route path="/unit/:n/grammar/:topic/practice" element={<GrammarDrill inLesson />} />
        <Route path="/review" element={<Review />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/practice" element={<PracticeHub />} />
        <Route path="/practice/test" element={<TestRunner />} />
        <Route path="/practice/grammar" element={<GrammarReference />} />
        <Route path="/grammar/:n/:topic" element={<GrammarTopicScreen />} />
        <Route path="/drill/grammar/:n/:topic" element={<GrammarDrill />} />
        <Route path="/practice/verbs" element={<VerbTrainer />} />
        <Route path="/verbs/:id" element={<VerbScreen />} />
        <Route path="/practice/lookalikes" element={<LookAlikes />} />
        <Route path="/drill/run/:key" element={<DrillRunner />} />
        <Route path="/talk" element={<TalkList />} />
        <Route path="/talk/:id" element={<TalkChat />} />
        <Route path="/reading" element={<ReadingList />} />
        <Route path="/reading/:id" element={<ReadingTextScreen />} />
        <Route path="/reading/:id/questions" element={<ReadingQuestions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </motion.div>
      {!immersive && <nav className="dock">
        {tabs.map(t => {
          // Inside a unit, keep the Course tab highlighted; same for Practice sub-screens.
          const active = tabOf(pathname) === t.to
          // Tapping the tab you're in goes to its start; another tab opens where you left it.
          return (
          <NavLink key={t.to} to={active ? t.to : lastIn.current[t.to] ?? t.to} end className={active ? 'dock-active' : ''}>
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
