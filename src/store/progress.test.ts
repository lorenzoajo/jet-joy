import { beforeEach, describe, expect, it } from 'vitest'
import { loadProgress, saveBest, STORAGE_KEY } from './progress'

class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string): string | null { return this.m.get(k) ?? null }
  setItem(k: string, v: string): void { this.m.set(k, v) }
  removeItem(k: string): void { this.m.delete(k) }
}

describe('progress', () => {
  let s: MemStorage
  beforeEach(() => { s = new MemStorage() })

  it('defaults to empty', () => {
    expect(loadProgress(s)).toEqual({})
  })

  it('keeps the best rating', () => {
    saveBest('a', 2, s)
    saveBest('a', 1, s)
    expect(loadProgress(s)).toEqual({ a: 2 })
    saveBest('a', 3, s)
    expect(loadProgress(s)).toEqual({ a: 3 })
  })

  it('survives corrupt data', () => {
    s.setItem(STORAGE_KEY, '{nope')
    expect(loadProgress(s)).toEqual({})
    s.setItem(STORAGE_KEY, JSON.stringify({ a: 'x', b: 2, c: 9 }))
    expect(loadProgress(s)).toEqual({ b: 2 })
  })

  it('survives a throwing storage', () => {
    const bad = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(loadProgress(bad)).toEqual({})
    expect(() => saveBest('a', 1, bad)).not.toThrow()
  })
})
