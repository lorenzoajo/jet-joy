export type GoalKey = 'stars' | 'rings' | 'blimps'
export type MissionGoal = Partial<Record<GoalKey, number>>
export type MissionStatus = 'running' | 'won' | 'lost'

export interface MissionProgress {
  stars: number
  rings: number
  blimps: number
  time: number
  fuel: number
}

export interface MissionSpawn {
  stars: number
  rings: number
  fuel: number
  boosts: number
  blimps: number
}

export interface MissionDef {
  id: string
  name: string
  tagline: string
  goal: MissionGoal
  timeLimit?: number
  /** [2★ time, 3★ time] in seconds; finishing at or under the value earns the rating. */
  par: readonly [number, number]
  /** Fuel units (out of 100) drained per second. */
  fuelDrain: number
  spawn: MissionSpawn
  /** 0..1 — scales blimp fire rate and missile turn speed. */
  aggression: number
  seed: number
}

export const MISSIONS: readonly MissionDef[] = [
  {
    id: 'first-flight',
    name: 'First Flight',
    tagline: 'Grab 5 shiny stars. Easy peasy!',
    goal: { stars: 5 },
    par: [90, 55],
    fuelDrain: 1.0,
    spawn: { stars: 8, rings: 10, fuel: 10, boosts: 4, blimps: 0 },
    aggression: 0,
    seed: 11,
  },
  {
    id: 'ring-runner',
    name: 'Ring Runner',
    tagline: 'Zoom through 12 rings in 90 seconds.',
    goal: { rings: 12 },
    timeLimit: 90,
    par: [70, 50],
    fuelDrain: 1.1,
    spawn: { stars: 4, rings: 24, fuel: 10, boosts: 6, blimps: 0 },
    aggression: 0,
    seed: 23,
  },
  {
    id: 'blimp-pop',
    name: 'Blimp Pop',
    tagline: 'Grumpy blimps! Pop 4 of them.',
    goal: { blimps: 4 },
    par: [100, 65],
    fuelDrain: 1.0,
    spawn: { stars: 4, rings: 10, fuel: 12, boosts: 4, blimps: 6 },
    aggression: 0.35,
    seed: 37,
  },
  {
    id: 'long-haul',
    name: 'Long Haul',
    tagline: 'Fuel is scarce. Collect 10 stars.',
    goal: { stars: 10 },
    par: [150, 110],
    fuelDrain: 1.5,
    spawn: { stars: 14, rings: 14, fuel: 9, boosts: 6, blimps: 2 },
    aggression: 0.3,
    seed: 41,
  },
  {
    id: 'sky-party',
    name: 'Sky Party',
    tagline: '8 stars and 5 blimps. Show off!',
    goal: { stars: 8, blimps: 5 },
    par: [180, 130],
    fuelDrain: 1.2,
    spawn: { stars: 12, rings: 16, fuel: 14, boosts: 6, blimps: 8 },
    aggression: 0.55,
    seed: 59,
  },
]

const GOAL_KEYS: readonly GoalKey[] = ['stars', 'rings', 'blimps']

export function goalMet(def: MissionDef, p: MissionProgress): boolean {
  return GOAL_KEYS.every((k) => p[k] >= (def.goal[k] ?? 0))
}

export function evaluate(def: MissionDef, p: MissionProgress): MissionStatus {
  if (goalMet(def, p)) return 'won'
  if (p.fuel <= 0) return 'lost'
  if (def.timeLimit !== undefined && p.time > def.timeLimit) return 'lost'
  return 'running'
}

export function rate(def: MissionDef, p: MissionProgress): 1 | 2 | 3 {
  const [two, three] = def.par
  if (p.time <= three) return 3
  if (p.time <= two) return 2
  return 1
}
