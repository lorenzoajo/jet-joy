import { logError } from '../log'

export const STORAGE_KEY = 'jet-joy:progress:v1'
export type Progress = Record<string, 1 | 2 | 3>
export type KV = Pick<Storage, 'getItem' | 'setItem'>

const isRating = (v: unknown): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3

function defaultStorage(): KV | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadProgress(storage: KV | null = defaultStorage()): Progress {
  if (!storage) return {}
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Progress = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (isRating(v)) out[k] = v
    return out
  } catch (e) {
    logError('progress.load', e)
    return {}
  }
}

export function saveBest(id: string, stars: 1 | 2 | 3, storage: KV | null = defaultStorage()): Progress {
  const cur = loadProgress(storage)
  const next: Progress = { ...cur, [id]: Math.max(cur[id] ?? 0, stars) as 1 | 2 | 3 }
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (e) {
    logError('progress.save', e)
  }
  return next
}
