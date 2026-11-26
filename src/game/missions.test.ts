import { describe, expect, it } from 'vitest'
import { MISSIONS, evaluate, rate, type MissionProgress } from './missions'

const base: MissionProgress = { stars: 0, rings: 0, blimps: 0, time: 0, fuel: 100 }
const byId = (id: string) => {
  const m = MISSIONS.find((x) => x.id === id)
  if (!m) throw new Error(id)
  return m
}

describe('missions', () => {
  it('has the five spec missions with exact goals', () => {
    expect(MISSIONS.map((m) => m.id)).toEqual(['first-flight', 'ring-runner', 'blimp-pop', 'long-haul', 'sky-party'])
    expect(byId('first-flight').goal).toEqual({ stars: 5 })
    expect(byId('ring-runner').goal).toEqual({ rings: 12 })
    expect(byId('ring-runner').timeLimit).toBe(90)
    expect(byId('blimp-pop').goal).toEqual({ blimps: 4 })
    expect(byId('long-haul').goal).toEqual({ stars: 10 })
    expect(byId('sky-party').goal).toEqual({ stars: 8, blimps: 5 })
  })

  it('is running until goal met', () => {
    expect(evaluate(byId('first-flight'), { ...base, stars: 4 })).toBe('running')
    expect(evaluate(byId('first-flight'), { ...base, stars: 5 })).toBe('won')
    expect(evaluate(byId('sky-party'), { ...base, stars: 8, blimps: 4 })).toBe('running')
    expect(evaluate(byId('sky-party'), { ...base, stars: 8, blimps: 5 })).toBe('won')
  })

  it('loses when fuel hits 0', () => {
    expect(evaluate(byId('first-flight'), { ...base, fuel: 0 })).toBe('lost')
  })

  it('win beats empty fuel on the same frame', () => {
    expect(evaluate(byId('first-flight'), { ...base, stars: 5, fuel: 0 })).toBe('won')
  })

  it('loses when time limit exceeded', () => {
    expect(evaluate(byId('ring-runner'), { ...base, rings: 11, time: 90.01 })).toBe('lost')
    expect(evaluate(byId('ring-runner'), { ...base, rings: 12, time: 89 })).toBe('won')
  })

  it('rates by completion time', () => {
    const m = byId('first-flight')
    const [two, three] = m.par
    expect(rate(m, { ...base, time: three })).toBe(3)
    expect(rate(m, { ...base, time: three + 1 })).toBe(2)
    expect(rate(m, { ...base, time: two + 1 })).toBe(1)
  })
})
