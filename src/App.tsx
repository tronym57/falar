import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from './screens/Home'
import Course from './screens/Course'
import Vocab from './screens/Vocab'
import Settings from './screens/Settings'
import Unit from './screens/Unit'

const tabs = [
  { to: '/', label: 'Home', icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/course', label: 'Course', icon: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7" /> },
  { to: '/vocab', label: 'Vocab', icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
  { to: '/settings', label: 'Settings', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></> },
]

export default function App() {
  const { pathname } = useLocation()
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/course" element={<Course />} />
        <Route path="/vocab" element={<Vocab />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/unit/:n" element={<Unit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <nav className="tabbar">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            // Inside a unit, keep the Course tab highlighted.
            className={({ isActive }) => (isActive || (t.to === '/course' && pathname.startsWith('/unit/')) ? 'active' : '')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
