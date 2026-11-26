import { describe, expect, it } from 'vitest'
import { generateLayout, insideIsland } from './layout'
import { MISSIONS } from './missions'
import { mulberry32 } from './rng'

describe('layout', () => {
  for (const m of MISSIONS) {
    it(`${m.id}: spawns requested counts, nothing inside islands`, () => {
      const l = generateLayout(mulberry32(m.seed), m.spawn)
      expect(l.stars).toHaveLength(m.spawn.stars)
      expect(l.rings).toHaveLength(m.spawn.rings)
      expect(l.fuel).toHaveLength(m.spawn.fuel)
      expect(l.blimps).toHaveLength(m.spawn.blimps)
      expect(l.islands.length).toBeGreaterThan(8)
      const pts = [...l.fuel, ...l.boosts, ...l.rings.map((r) => r.pos), ...l.blimps]
      for (const p of pts) for (const isl of l.islands) expect(insideIsland(p, isl)).toBe(false)
    })
  }

  it('is deterministic per seed', () => {
    const a = generateLayout(mulberry32(5), MISSIONS[0]!.spawn)
    const b = generateLayout(mulberry32(5), MISSIONS[0]!.spawn)
    expect(a).toEqual(b)
  })
})
