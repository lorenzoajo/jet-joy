import type { Vec3 } from './flight'
import { WORLD_RADIUS } from './flight'
import type { MissionSpawn } from './missions'
import { range, type Rng } from './rng'

export interface Island {
  x: number
  z: number
  radius: number
  /** Grass surface height. */
  top: number
  /** Depth of the rocky cone below the surface. */
  depth: number
}

export interface RingSpot {
  pos: Vec3
  /** Heading the ring faces (plane normal yaw). */
  yaw: number
}

export interface Layout {
  islands: Island[]
  stars: Vec3[]
  fuel: Vec3[]
  boosts: Vec3[]
  rings: RingSpot[]
  blimps: Vec3[]
}

const ISLAND_COUNT = 16
const PLAY_RADIUS = WORLD_RADIUS - 60

/** Island collider: a vertical cylinder from (top - depth) to top + tree headroom. */
export function insideIsland(p: Vec3, isl: Island, pad = 0): boolean {
  const dx = p.x - isl.x
  const dz = p.z - isl.z
  const r = isl.radius + pad
  if (dx * dx + dz * dz > r * r) return false
  return p.y < isl.top + 8 + pad && p.y > isl.top - isl.depth - pad
}

function randomInDisc(rng: Rng, maxR: number): { x: number; z: number } {
  const a = rng() * Math.PI * 2
  const r = Math.sqrt(rng()) * maxR
  return { x: Math.cos(a) * r, z: Math.sin(a) * r }
}

function freeSpot(rng: Rng, islands: readonly Island[], yLo: number, yHi: number, minR = 40): Vec3 {
  for (let i = 0; i < 60; i++) {
    const { x, z } = randomInDisc(rng, PLAY_RADIUS)
    if (Math.hypot(x, z) < minR) continue
    const p = { x, y: range(rng, yLo, yHi), z }
    if (!islands.some((isl) => insideIsland(p, isl, 10))) return p
  }
  return { x: 0, y: yHi, z: -minR - 20 }
}

export function generateLayout(rng: Rng, spawn: MissionSpawn): Layout {
  const islands: Island[] = []
  for (let tries = 0; islands.length < ISLAND_COUNT && tries < 400; tries++) {
    const { x, z } = randomInDisc(rng, PLAY_RADIUS)
    const radius = range(rng, 22, 55)
    // keep the spawn corridor clear
    if (Math.hypot(x, z) < radius + 60) continue
    if (islands.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius + radius + 30)) continue
    islands.push({ x, z, radius, top: range(rng, 18, 110), depth: radius * range(rng, 0.9, 1.4) })
  }

  // Stars sit above islands when possible: rewards exploring the map.
  const stars: Vec3[] = []
  for (let i = 0; i < spawn.stars; i++) {
    const isl = islands[Math.floor(rng() * islands.length)]
    if (isl && rng() < 0.6) stars.push({ x: isl.x, y: isl.top + range(rng, 16, 30), z: isl.z })
    else stars.push(freeSpot(rng, islands, 25, 140))
  }

  const fuel = Array.from({ length: spawn.fuel }, () => freeSpot(rng, islands, 20, 120))
  const boosts = Array.from({ length: spawn.boosts }, () => freeSpot(rng, islands, 20, 120))
  const blimps = Array.from({ length: spawn.blimps }, () => freeSpot(rng, islands, 50, 140, 160))

  // Rings come in gentle arcs of 4 so you can chain them for combos.
  const rings: RingSpot[] = []
  while (rings.length < spawn.rings) {
    const start = freeSpot(rng, islands, 30, 110)
    let yaw = rng() * Math.PI * 2
    const bend = range(rng, -0.35, 0.35)
    const climb = range(rng, -6, 6)
    const p = { ...start }
    for (let k = 0; k < 4 && rings.length < spawn.rings; k++) {
      if (!islands.some((isl) => insideIsland(p, isl, 14)) && Math.hypot(p.x, p.z) < PLAY_RADIUS) rings.push({ pos: { ...p }, yaw })
      p.x += -Math.sin(yaw) * 45
      p.z += -Math.cos(yaw) * 45
      p.y = Math.min(150, Math.max(20, p.y + climb))
      yaw += bend
    }
  }

  return { islands, stars, fuel, boosts, rings, blimps }
}
