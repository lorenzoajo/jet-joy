import { describe, expect, it } from 'vitest'
import { BASE_SPEED, BOOST_SPEED, CEILING, MAX_DT, MIN_ALT, WORLD_RADIUS, clampDt, createFlight, forward, stepFlight, type FlightInput } from './flight'

const idle: FlightInput = { x: 0, y: 0 }
const run = (s = createFlight(), input = idle, seconds = 1, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) s = stepFlight(s, input, dt)
  return s
}

describe('flight', () => {
  it('clamps dt', () => {
    expect(clampDt(5)).toBe(MAX_DT)
    expect(MAX_DT).toBeLessThanOrEqual(0.05)
    expect(clampDt(-1)).toBe(0)
    expect(clampDt(Number.NaN)).toBe(0)
  })

  it('flies forward at base speed', () => {
    const s = run(createFlight(), idle, 3)
    expect(s.speed).toBeCloseTo(BASE_SPEED, 0)
    expect(s.pos.z).toBeLessThan(-50)
  })

  it('boost raises speed and decays', () => {
    const s = run({ ...createFlight(), boostTime: 3 }, idle, 1.5)
    expect(s.speed).toBeGreaterThan(BASE_SPEED + 15)
    expect(s.speed).toBeLessThanOrEqual(BOOST_SPEED)
    const after = run(s, idle, 5)
    expect(after.boostTime).toBe(0)
    expect(after.speed).toBeLessThan(BASE_SPEED + 2)
  })

  it('turns when rolling', () => {
    const s = run(createFlight(), { x: 1, y: 0 }, 1)
    expect(s.yaw).toBeLessThan(-0.3)
    expect(s.roll).toBeGreaterThan(0.3)
  })

  it('bounces off the floor and respects the ceiling', () => {
    let s = run({ ...createFlight(), pos: { x: 0, y: MIN_ALT + 1, z: 0 } }, { x: 0, y: -1 }, 2)
    expect(s.pos.y).toBeGreaterThanOrEqual(MIN_ALT)
    s = run({ ...createFlight(), pos: { x: 0, y: CEILING - 1, z: 0 } }, { x: 0, y: 1 }, 3)
    expect(s.pos.y).toBeLessThanOrEqual(CEILING)
  })

  it('reports a bump when hitting the floor', () => {
    const s = stepFlight({ ...createFlight(), pos: { x: 0, y: MIN_ALT - 0.1, z: 0 }, pitch: -0.5 }, idle, 1 / 60)
    expect(s.bumped).toBe(true)
  })

  it('steers back inside the world bounds without NaN', () => {
    // heading straight out along +x
    let s = { ...createFlight(), pos: { x: WORLD_RADIUS + 20, y: 60, z: 0 }, yaw: -Math.PI / 2 }
    const f = forward(s)
    expect(f.x).toBeCloseTo(1)
    s = run(s, { x: 0, y: 0 }, 8)
    expect(Math.hypot(s.pos.x, s.pos.z)).toBeLessThan(WORLD_RADIUS + 20)
    expect(Number.isFinite(s.pos.x + s.pos.y + s.pos.z + s.yaw)).toBe(true)
  })

  it('ignores NaN input', () => {
    const s = run(createFlight(), { x: Number.NaN, y: Number.NaN }, 1)
    expect(Number.isFinite(s.pos.x + s.pos.y + s.pos.z)).toBe(true)
  })
})
