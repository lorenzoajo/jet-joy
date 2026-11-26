export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface FlightState {
  pos: Vec3
  /** Heading in radians; 0 faces -Z, positive turns left. */
  yaw: number
  pitch: number
  roll: number
  speed: number
  boostTime: number
  /** True on the frame the plane bounced off the floor. */
  bumped: boolean
  outOfBounds: boolean
}

/** Stick input in -1..1. x>0 = bank right, y>0 = nose up. */
export interface FlightInput {
  x: number
  y: number
}

export const BASE_SPEED = 38
export const BOOST_SPEED = 72
export const MIN_ALT = 4
export const CEILING = 200
export const WORLD_RADIUS = 620
export const MAX_DT = 0.05

const MAX_ROLL = 1.05
const MAX_PITCH = 0.75
const TURN_RATE = 1.35
const ROLL_RESPONSE = 4
const PITCH_RESPONSE = 3
const SPEED_RESPONSE = 2.2
const RETURN_RATE = 1.6
const HARD_LIMIT = WORLD_RADIUS + 90

const finite = (v: number): number => (Number.isFinite(v) ? v : 0)
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const approach = (cur: number, target: number, rate: number, dt: number): number =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt))
const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a))

export function clampDt(dt: number): number {
  return clamp(finite(dt), 0, MAX_DT)
}

export function createFlight(): FlightState {
  return { pos: { x: 0, y: 60, z: 0 }, yaw: 0, pitch: 0, roll: 0, speed: BASE_SPEED, boostTime: 0, bumped: false, outOfBounds: false }
}

export function forward(s: Pick<FlightState, 'yaw' | 'pitch'>): Vec3 {
  const cp = Math.cos(s.pitch)
  return { x: -Math.sin(s.yaw) * cp, y: Math.sin(s.pitch), z: -Math.cos(s.yaw) * cp }
}

export function stepFlight(s: FlightState, input: FlightInput, rawDt: number): FlightState {
  const dt = clampDt(rawDt)
  const ix = clamp(finite(input.x), -1, 1)
  const iy = clamp(finite(input.y), -1, 1)

  let roll = approach(s.roll, ix * MAX_ROLL, ROLL_RESPONSE, dt)
  let pitch = approach(s.pitch, iy * MAX_PITCH, PITCH_RESPONSE, dt)
  let yaw = s.yaw - Math.sin(roll) * TURN_RATE * dt

  const dist = Math.hypot(s.pos.x, s.pos.z)
  const outOfBounds = dist > WORLD_RADIUS
  if (outOfBounds) {
    // Ease the heading back toward the island centre; feels like a friendly autopilot.
    const home = Math.atan2(s.pos.x, s.pos.z)
    const diff = wrapAngle(home - yaw)
    yaw += clamp(diff, -RETURN_RATE * dt, RETURN_RATE * dt)
    roll = approach(roll, -Math.sign(diff) * MAX_ROLL * 0.7, ROLL_RESPONSE, dt)
  }
  yaw = wrapAngle(yaw)

  const boostTime = Math.max(0, s.boostTime - dt)
  const speed = approach(s.speed, boostTime > 0 ? BOOST_SPEED : BASE_SPEED, SPEED_RESPONSE, dt)

  const f = forward({ yaw, pitch })
  const pos: Vec3 = { x: s.pos.x + f.x * speed * dt, y: s.pos.y + f.y * speed * dt, z: s.pos.z + f.z * speed * dt }

  let bumped = false
  if (pos.y < MIN_ALT) {
    pos.y = MIN_ALT
    if (pitch < 0.25) {
      pitch = 0.35
      bumped = s.pitch < -0.05 || s.pos.y < MIN_ALT
    }
  }
  if (pos.y > CEILING) {
    pos.y = CEILING
    pitch = Math.min(pitch, 0)
  }

  const d = Math.hypot(pos.x, pos.z)
  if (d > HARD_LIMIT) {
    pos.x *= HARD_LIMIT / d
    pos.z *= HARD_LIMIT / d
  }

  return { pos, yaw, pitch, roll, speed, boostTime, bumped, outOfBounds }
}
