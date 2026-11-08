// Small key-value settings store on localStorage. Falls back to memory where
// localStorage is unavailable (private mode, tests), so callers never crash.
const memory = new Map<string, string>()

function store(): Storage | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}

export const kv = {
  get(key: string): string | null {
    try { return store()?.getItem(key) ?? memory.get(key) ?? null } catch { return memory.get(key) ?? null }
  },
  set(key: string, value: string) {
    memory.set(key, value)
    try { store()?.setItem(key, value) } catch { /* memory copy is enough */ }
  },
  remove(key: string) {
    memory.delete(key)
    try { store()?.removeItem(key) } catch { /* ignore */ }
  },
}

export const LAST_ROUTE = 'falar.lastRoute'
