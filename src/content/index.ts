import type { Unit } from './types'

// All unit files are bundled at build time (validated by `npm run lint:content`).
const files = import.meta.glob<Unit>('../../content/a1/*.json', { eager: true, import: 'default' })

export const a1Content: Record<number, Unit> = Object.fromEntries(
  Object.values(files).map(u => [u.n, u]),
)
