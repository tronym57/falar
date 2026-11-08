import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type Kind = 'info' | 'error'
type Toast = { id: number; text: string; kind: Kind }

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {})

/** Short message at the bottom of the screen: feedback for taps, and recoverable errors. */
export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((text: string, kind: Kind = 'info') => {
    clearTimeout(timer.current)
    setToast({ id: Date.now(), text, kind })
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 5000 : 2500)
  }, [])

  // Errors outside React rendering (failed fetch, audio, storage) still reach the user.
  useEffect(() => {
    const onError = (e: ErrorEvent) => show(`Something went wrong: ${e.message}`, 'error')
    const onRejection = (e: PromiseRejectionEvent) =>
      show(`Something went wrong: ${e.reason?.message ?? e.reason}`, 'error')
    addEventListener('error', onError)
    addEventListener('unhandledrejection', onRejection)
    return () => {
      removeEventListener('error', onError)
      removeEventListener('unhandledrejection', onRejection)
    }
  }, [show])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.id} className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </ToastContext.Provider>
  )
}
