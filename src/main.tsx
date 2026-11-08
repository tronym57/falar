import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import { ToastProvider } from './toast.tsx'

// iOS Safari only applies :active (pressed) styles when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true })

// HashRouter: static hosting has no server-side routing, so URLs look like /#/course.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
)
