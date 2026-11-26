import * as THREE from 'three'
import { logError } from '../log'
import { audio, type Sfx } from './audio'
import { BOOST_SPEED, BASE_SPEED, createFlight, forward, MAX_DT, stepFlight, type FlightState } from './flight'
import type { Input } from './input'
import { generateLayout, insideIsland, type Island } from './layout'
import { evaluate, rate, type MissionDef, type MissionProgress } from './missions'
import { createJet, type JetModel } from './models/jet'
import { createArrow, createBlimp, createBoost, createBubble, createBullet, createFuel, createLockReticle, createRing, createStar, type BlimpModel } from './models/props'
import { createCloud, createIsland, createSea, createSky, SKY_HORIZON } from './models/scenery'
import { mulberry32, range, type Rng } from './rng'

export interface HudSnapshot {
  fuel: number
  boostMeter: number
  boosting: boolean
  stars: number
  rings: number
  blimps: number
  time: number
  timeLeft: number | null
  score: number
  combo: number
  lock: boolean
  danger: boolean
}

export type GameEvent = 'star' | 'ring' | 'fuel' | 'boost' | 'blimp' | 'hit' | 'bump' | 'lowfuel' | 'bounds'

export interface GameResult {
  won: boolean
  rating: 0 | 1 | 2 | 3
  progress: MissionProgress
  score: number
}

export interface GameCallbacks {
  onHud: (s: HudSnapshot) => void
  onEvent: (e: GameEvent, label?: string) => void
  onEnd: (r: GameResult) => void
}

type PickupKind = 'star' | 'fuel' | 'boost'
interface Pickup {
  kind: PickupKind
  obj: THREE.Group
  base: THREE.Vector3
  active: boolean
  respawnAt: number
  phase: number
}
interface Ring {
  obj: THREE.Group
  pos: THREE.Vector3
  normal: THREE.Vector3
  active: boolean
  respawnAt: number
  prevSide: number
}
interface Blimp {
  model: BlimpModel
  center: THREE.Vector3
  orbitR: number
  angle: number
  dir: 1 | -1
  hp: number
  alive: boolean
  cooldown: number
  flash: number
}
interface Projectile {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  life: number
  active: boolean
}
interface Particle extends Projectile {
  maxLife: number
  size: number
}

const FUEL_MAX = 100
const BOOST_COST = 34
const PICKUP_RADIUS = 8
const RING_RADIUS = 9.5
const BLIMP_HP = 3
const BLIMP_HIT_RADIUS = 8
const BUBBLE_SPEED = 30
const BUBBLE_LIFE = 9
const BUBBLE_DAMAGE = 10
const BULLET_SPEED = 180
const FIRE_INTERVAL = 0.13
const LOCK_RANGE = 280
const LOCK_COS = Math.cos(THREE.MathUtils.degToRad(24))
const BUMP_DAMAGE = 4
const HUD_INTERVAL = 0.1

const SCORE = { star: 500, ring: 200, blimp: 1000, bubble: 50 } as const

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(62, 1, 0.5, 3000)
  private rng: Rng
  private islands: Island[]
  private jet: JetModel
  private flight: FlightState = createFlight()
  private pickups: Pickup[] = []
  private rings: Ring[] = []
  private blimps: Blimp[] = []
  private bubbles: Projectile[] = []
  private bullets: Projectile[] = []
  private particles: Particle[] = []
  private clouds: THREE.Group[] = []
  private arrow = new THREE.Group()
  private reticle = createLockReticle()
  private progress: MissionProgress = { stars: 0, rings: 0, blimps: 0, time: 0, fuel: FUEL_MAX }
  private boostMeter = 50
  private score = 0
  private combo = 0
  private lastRingAt = -99
  private fireTimer = 0
  private lastPenaltyAt = -99
  private shake = 0
  private lowFuelWarned = false
  private hudTimer = 0
  private lockTarget: THREE.Object3D | null = null
  private danger = false
  private running = false
  private paused = false
  private ended = false
  private raf = 0
  private lastFrame = 0
  private resizeObs: ResizeObserver

  constructor(
    private canvas: HTMLCanvasElement,
    private mission: MissionDef,
    private input: Input,
    private cb: GameCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(SKY_HORIZON)
    this.scene.fog = new THREE.Fog(SKY_HORIZON, 350, 1300)

    this.scene.add(new THREE.HemisphereLight('#e6f6ff', '#5aa36a', 1.4))
    const sun = new THREE.DirectionalLight('#fff4d6', 2.2)
    sun.position.set(300, 500, 200)
    this.scene.add(sun)
    this.scene.add(createSky(), createSea())

    this.rng = mulberry32(mission.seed)
    const layout = generateLayout(this.rng, mission.spawn)
    this.islands = layout.islands
    for (const isl of layout.islands) this.scene.add(createIsland(isl, this.rng))
    for (let i = 0; i < 34; i++) {
      const c = createCloud(this.rng)
      const a = this.rng() * Math.PI * 2
      const r = range(this.rng, 80, 1100)
      c.position.set(Math.cos(a) * r, range(this.rng, 70, 190), Math.sin(a) * r)
      c.rotation.y = this.rng() * Math.PI
      this.clouds.push(c)
      this.scene.add(c)
    }

    const addPickup = (kind: PickupKind, p: { x: number; y: number; z: number }): void => {
      const obj = kind === 'star' ? createStar() : kind === 'fuel' ? createFuel() : createBoost()
      obj.position.set(p.x, p.y, p.z)
      this.scene.add(obj)
      this.pickups.push({ kind, obj, base: new THREE.Vector3(p.x, p.y, p.z), active: true, respawnAt: 0, phase: this.rng() * 6 })
    }
    layout.stars.forEach((p) => addPickup('star', p))
    layout.fuel.forEach((p) => addPickup('fuel', p))
    layout.boosts.forEach((p) => addPickup('boost', p))

    for (const r of layout.rings) {
      const obj = createRing()
      obj.position.set(r.pos.x, r.pos.y, r.pos.z)
      obj.rotation.y = r.yaw
      this.scene.add(obj)
      const normal = new THREE.Vector3(-Math.sin(r.yaw), 0, -Math.cos(r.yaw))
      this.rings.push({ obj, pos: obj.position.clone(), normal, active: true, respawnAt: 0, prevSide: 0 })
    }

    for (const b of layout.blimps) {
      const model = createBlimp()
      this.scene.add(model.root)
      this.blimps.push({
        model,
        center: new THREE.Vector3(b.x, b.y, b.z),
        orbitR: range(this.rng, 30, 70),
        angle: this.rng() * Math.PI * 2,
        dir: this.rng() < 0.5 ? 1 : -1,
        hp: BLIMP_HP,
        alive: true,
        cooldown: range(this.rng, 2, 5),
        flash: 0,
      })
    }

    this.jet = createJet()
    this.scene.add(this.jet.root)

    this.arrow.add(createArrow())
    this.arrow.rotation.order = 'YXZ'
    this.scene.add(this.arrow)
    this.reticle.visible = false
    this.scene.add(this.reticle)

    for (let i = 0; i < 12; i++) this.bubbles.push(this.pooled(createBubble()))
    for (let i = 0; i < 40; i++) this.bullets.push(this.pooled(createBullet()))
    const partGeo = new THREE.IcosahedronGeometry(1, 0)
    for (let i = 0; i < 80; i++) {
      const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }))
      this.particles.push({ ...this.pooled(m), maxLife: 1, size: 1 })
    }

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(canvas)
    this.resize()
    this.syncJet()
    this.camera.position.set(0, 70, 25)
  }

  start(): void {
    if (this.running) return
    this.running = true
    audio.startEngine()
    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  pause(): void {
    this.paused = true
    audio.suspend()
  }

  resume(): void {
    if (this.ended) return
    this.paused = false
    this.lastFrame = performance.now()
    audio.resume()
  }

  get isPaused(): boolean {
    return this.paused
  }

  dispose(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.resizeObs.disconnect()
    audio.stopEngine()
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => m.dispose())
      }
    })
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private pooled(mesh: THREE.Mesh): Projectile {
    mesh.visible = false
    this.scene.add(mesh)
    return { mesh, vel: new THREE.Vector3(), life: 0, active: false }
  }

  private resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // Portrait phones get a wider FOV so the world doesn't feel cramped.
    this.camera.userData.baseFov = w < h ? 78 : 62
    this.camera.updateProjectionMatrix()
  }

  private frame = (now: number): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min((now - this.lastFrame) / 1000, MAX_DT)
    this.lastFrame = now
    try {
      if (!this.paused && !this.ended) this.update(dt)
      else if (this.ended) this.updateAmbient(dt)
      this.renderer.render(this.scene, this.camera)
    } catch (e) {
      logError('game.frame', e)
      this.running = false
    }
  }

  private sfx(s: Sfx): void {
    audio.play(s)
  }

  private update(dt: number): void {
    const p = this.progress
    p.time += dt

    if (this.input.consumeBoost() && this.boostMeter >= BOOST_COST) {
      this.boostMeter -= BOOST_COST
      this.flight.boostTime = Math.max(this.flight.boostTime, 2.5)
      this.sfx('boost')
      this.cb.onEvent('boost')
    }

    const wasOut = this.flight.outOfBounds
    this.flight = stepFlight(this.flight, this.input.read(), dt)
    if (this.flight.outOfBounds && !wasOut) this.cb.onEvent('bounds')
    if (this.flight.bumped) {
      this.penalty(BUMP_DAMAGE, 'bump')
      this.burst(new THREE.Vector3(this.flight.pos.x, 1, this.flight.pos.z), '#e9fbff', 10, 18)
    }
    this.collideIslands()

    p.fuel = Math.max(0, p.fuel - this.mission.fuelDrain * dt)
    if (p.fuel < 25 && !this.lowFuelWarned) {
      this.lowFuelWarned = true
      this.sfx('warn')
      this.cb.onEvent('lowfuel')
    } else if (p.fuel > 35) this.lowFuelWarned = false

    this.updatePickups(dt)
    this.updateRings(dt)
    this.updateBlimps(dt)
    this.updateBubbles(dt)
    this.updateLockAndFire(dt)
    this.updateBullets(dt)
    this.updateAmbient(dt)
    this.syncJet()
    this.updateArrow()
    this.updateCamera(dt)

    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.hudTimer = HUD_INTERVAL
      this.cb.onHud(this.snapshot())
    }

    const status = evaluate(this.mission, p)
    if (status !== 'running') this.finish(status === 'won')
  }

  private finish(won: boolean): void {
    this.ended = true
    this.reticle.visible = false
    audio.stopEngine()
    this.sfx(won ? 'win' : 'lose')
    if (won) this.burst(this.jet.root.position.clone(), '#ffd23f', 30, 30)
    this.cb.onHud(this.snapshot())
    this.cb.onEnd({ won, rating: won ? rate(this.mission, this.progress) : 0, progress: { ...this.progress }, score: this.score })
  }

  private snapshot(): HudSnapshot {
    const p = this.progress
    return {
      fuel: p.fuel,
      boostMeter: this.boostMeter,
      boosting: this.flight.boostTime > 0,
      stars: p.stars,
      rings: p.rings,
      blimps: p.blimps,
      time: p.time,
      timeLeft: this.mission.timeLimit !== undefined ? Math.max(0, this.mission.timeLimit - p.time) : null,
      score: this.score,
      combo: this.combo,
      lock: this.lockTarget !== null,
      danger: this.danger,
    }
  }

  private penalty(amount: number, ev: GameEvent): void {
    if (this.progress.time - this.lastPenaltyAt < 0.8) return
    this.lastPenaltyAt = this.progress.time
    this.progress.fuel = Math.max(0, this.progress.fuel - amount)
    this.shake = Math.max(this.shake, ev === 'hit' ? 0.6 : 0.35)
    this.sfx(ev === 'hit' ? 'hit' : 'bump')
    this.cb.onEvent(ev, `-${amount}`)
  }

  private collideIslands(): void {
    const pos = this.flight.pos
    for (const isl of this.islands) {
      if (!insideIsland(pos, isl, 3)) continue
      if (pos.y > isl.top + 2) {
        // Skimmed the treetops: hop up.
        pos.y = isl.top + 12
        this.flight.pitch = 0.45
      } else {
        const dx = pos.x - isl.x
        const dz = pos.z - isl.z
        const d = Math.hypot(dx, dz) || 1
        pos.x = isl.x + (dx / d) * (isl.radius + 4)
        pos.z = isl.z + (dz / d) * (isl.radius + 4)
        // Face away from the island (heading convention from flight.ts).
        this.flight.yaw = Math.atan2(-dx, -dz)
      }
      this.burst(new THREE.Vector3(pos.x, pos.y, pos.z), '#c9946a', 10, 14)
      this.penalty(BUMP_DAMAGE, 'bump')
      return
    }
  }

  private jetPos(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.flight.pos.x, this.flight.pos.y, this.flight.pos.z)
  }

  private updatePickups(dt: number): void {
    const t = this.progress.time
    const jp = this.jetPos(tmpA)
    for (const pk of this.pickups) {
      if (!pk.active) {
        if (pk.kind !== 'star' && t >= pk.respawnAt) {
          pk.active = true
          pk.obj.visible = true
          pk.obj.scale.setScalar(0.01)
        }
        continue
      }
      pk.obj.scale.setScalar(Math.min(1, pk.obj.scale.x + dt * 2))
      pk.obj.position.y = pk.base.y + Math.sin(t * 1.6 + pk.phase) * 1.2
      pk.obj.rotation.y += dt * (pk.kind === 'star' ? 2.2 : 0.8)
      if (pk.obj.position.distanceToSquared(jp) > PICKUP_RADIUS * PICKUP_RADIUS) continue

      pk.active = false
      pk.obj.visible = false
      if (pk.kind === 'star') {
        this.progress.stars++
        this.score += SCORE.star
        this.sfx('star')
        this.burst(pk.obj.position, '#ffd23f', 16, 22)
        this.cb.onEvent('star', `+${SCORE.star}`)
      } else if (pk.kind === 'fuel') {
        this.progress.fuel = Math.min(FUEL_MAX, this.progress.fuel + 35)
        pk.respawnAt = t + 15
        this.sfx('fuel')
        this.burst(pk.obj.position, '#ff4d6d', 12, 18)
        this.cb.onEvent('fuel', '+35')
      } else {
        this.flight.boostTime = Math.max(this.flight.boostTime, 2.5)
        this.boostMeter = Math.min(100, this.boostMeter + 50)
        pk.respawnAt = t + 10
        this.sfx('boost')
        this.burst(pk.obj.position, '#7dff4f', 12, 18)
        this.cb.onEvent('boost')
      }
    }
  }

  private updateRings(dt: number): void {
    const t = this.progress.time
    const jp = this.jetPos(tmpA)
    for (const r of this.rings) {
      const side = tmpB.subVectors(jp, r.pos).dot(r.normal)
      if (!r.active) {
        if (t >= r.respawnAt) {
          r.active = true
          r.obj.visible = true
          r.obj.scale.setScalar(0.01)
        }
      } else {
        r.obj.scale.setScalar(Math.min(1, r.obj.scale.x + dt * 2))
        const crossed = r.prevSide !== 0 && Math.sign(side) !== Math.sign(r.prevSide)
        if (crossed && jp.distanceTo(r.pos) < RING_RADIUS + 1) this.passRing(r)
      }
      r.prevSide = side
    }
    if (t - this.lastRingAt > 4) this.combo = 0
  }

  private passRing(r: Ring): void {
    const t = this.progress.time
    this.combo = t - this.lastRingAt < 4 ? this.combo + 1 : 1
    this.lastRingAt = t
    this.progress.rings++
    const pts = SCORE.ring * this.combo
    this.score += pts
    this.flight.boostTime = Math.max(this.flight.boostTime, 1.2)
    this.boostMeter = Math.min(100, this.boostMeter + 15)
    r.active = false
    r.obj.visible = false
    r.respawnAt = t + 8
    this.sfx('ring')
    this.burst(r.pos, '#36e0c8', 14, 20)
    this.cb.onEvent('ring', this.combo > 1 ? `x${this.combo} +${pts}` : `+${pts}`)
  }

  private updateBlimps(dt: number): void {
    const jp = this.jetPos(tmpA)
    const aggr = this.mission.aggression
    for (const b of this.blimps) {
      if (!b.alive) continue
      b.angle += (b.dir * 9 * dt) / b.orbitR
      const root = b.model.root
      root.position.set(
        b.center.x + Math.cos(b.angle) * b.orbitR,
        b.center.y + Math.sin(this.progress.time * 0.7 + b.orbitR) * 3,
        b.center.z + Math.sin(b.angle) * b.orbitR,
      )
      // Velocity is the orbit tangent; heading follows the flight.ts convention.
      const vx = -Math.sin(b.angle) * b.dir
      const vz = Math.cos(b.angle) * b.dir
      root.rotation.y = Math.atan2(-vx, -vz)
      b.model.prop.rotation.z += dt * 12
      b.flash = Math.max(0, b.flash - dt * 4)
      b.model.flash.emissive.setRGB(b.flash, b.flash, b.flash)

      b.cooldown -= dt
      if (aggr > 0 && b.cooldown <= 0 && root.position.distanceTo(jp) < 230) {
        b.cooldown = THREE.MathUtils.lerp(7, 3, aggr) + this.rng() * 2
        this.fireBubble(root.position)
      }
    }
  }

  private fireBubble(from: THREE.Vector3): void {
    const bub = this.bubbles.find((x) => !x.active)
    if (!bub) return
    bub.active = true
    bub.mesh.visible = true
    bub.life = BUBBLE_LIFE
    bub.mesh.position.copy(from).y -= 6
    bub.vel.subVectors(this.jetPos(tmpB), bub.mesh.position).normalize().multiplyScalar(BUBBLE_SPEED)
  }

  private popBubble(b: Projectile): void {
    b.active = false
    b.mesh.visible = false
    this.burst(b.mesh.position, '#ff7ad9', 8, 14)
  }

  private updateBubbles(dt: number): void {
    const jp = this.jetPos(tmpA)
    const turn = THREE.MathUtils.lerp(0.7, 1.5, this.mission.aggression) * dt
    this.danger = false
    for (const b of this.bubbles) {
      if (!b.active) continue
      b.life -= dt
      if (b.life <= 0) {
        this.popBubble(b)
        continue
      }
      const want = tmpB.subVectors(jp, b.mesh.position)
      const dist = want.length()
      want.normalize().multiplyScalar(BUBBLE_SPEED)
      b.vel.lerp(want, Math.min(1, turn)).setLength(BUBBLE_SPEED)
      b.mesh.position.addScaledVector(b.vel, dt)
      const wob = 1 + Math.sin(b.life * 14) * 0.12
      b.mesh.scale.set(wob, 2 - wob, wob)
      if (dist < 70) this.danger = true
      if (dist < 4) {
        this.popBubble(b)
        this.penalty(BUBBLE_DAMAGE, 'hit')
      }
    }
  }

  private updateLockAndFire(dt: number): void {
    const jp = this.jetPos(tmpA)
    const f = forward(this.flight)
    const fwd = new THREE.Vector3(f.x, f.y, f.z)
    let best: THREE.Object3D | null = null
    let bestScore = Infinity
    const consider = (o: THREE.Object3D, rangeMax: number): void => {
      const to = tmpB.subVectors(o.position, jp)
      const d = to.length()
      if (d > rangeMax || d < 1) return
      const cos = to.dot(fwd) / d
      if (cos < LOCK_COS) return
      const s = d * (2 - cos)
      if (s < bestScore) {
        bestScore = s
        best = o
      }
    }
    for (const b of this.blimps) if (b.alive) consider(b.model.root, LOCK_RANGE)
    for (const b of this.bubbles) if (b.active) consider(b.mesh, 120)
    this.lockTarget = best

    const target = this.lockTarget as THREE.Object3D | null
    this.reticle.visible = target !== null
    if (!target) {
      this.fireTimer = 0
      return
    }
    this.reticle.position.copy(target.position)
    this.reticle.quaternion.copy(this.camera.quaternion)
    this.reticle.rotateZ(this.progress.time * 2)

    this.fireTimer -= dt
    if (this.fireTimer > 0) return
    this.fireTimer = FIRE_INTERVAL
    const bullet = this.bullets.find((x) => !x.active)
    if (!bullet) return
    bullet.active = true
    bullet.mesh.visible = true
    bullet.life = 1.8
    bullet.mesh.position.copy(jp).addScaledVector(fwd, 4)
    bullet.vel.subVectors(target.position, bullet.mesh.position).normalize().multiplyScalar(BULLET_SPEED)
    bullet.mesh.lookAt(tmpB.copy(bullet.mesh.position).add(bullet.vel))
    this.sfx('shoot')
  }

  private updateBullets(dt: number): void {
    for (const bl of this.bullets) {
      if (!bl.active) continue
      bl.life -= dt
      bl.mesh.position.addScaledVector(bl.vel, dt)
      let hit = bl.life <= 0
      for (const b of this.blimps) {
        if (hit || !b.alive) continue
        if (bl.mesh.position.distanceTo(b.model.root.position) < BLIMP_HIT_RADIUS) {
          hit = true
          this.hitBlimp(b)
        }
      }
      for (const bub of this.bubbles) {
        if (hit || !bub.active) continue
        if (bl.mesh.position.distanceTo(bub.mesh.position) < 3) {
          hit = true
          this.popBubble(bub)
          this.score += SCORE.bubble
          this.sfx('pop')
        }
      }
      if (hit) {
        bl.active = false
        bl.mesh.visible = false
      }
    }
  }

  private hitBlimp(b: Blimp): void {
    b.hp--
    b.flash = 1
    if (b.hp > 0) return
    b.alive = false
    b.model.root.visible = false
    this.progress.blimps++
    this.score += SCORE.blimp
    this.sfx('pop')
    this.shake = Math.max(this.shake, 0.3)
    this.burst(b.model.root.position, '#b07cff', 26, 30)
    this.burst(b.model.root.position, '#ffd23f', 10, 24)
    this.cb.onEvent('blimp', `+${SCORE.blimp}`)
  }

  private burst(at: THREE.Vector3, color: THREE.ColorRepresentation, count: number, speed: number): void {
    let n = 0
    for (const p of this.particles) {
      if (n >= count) break
      if (p.active) continue
      n++
      p.active = true
      p.mesh.visible = true
      p.mesh.position.copy(at)
      ;(p.mesh.material as THREE.MeshBasicMaterial).color.set(color)
      p.vel.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()))
      p.maxLife = p.life = 0.5 + Math.random() * 0.5
      p.size = 0.6 + Math.random() * 1.2
    }
  }

  /** Things that keep moving even after the mission ends. */
  private updateAmbient(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        p.mesh.visible = false
        continue
      }
      p.mesh.position.addScaledVector(p.vel, dt)
      p.vel.multiplyScalar(1 - 2 * dt)
      const k = p.life / p.maxLife
      p.mesh.scale.setScalar(p.size * k)
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = k
    }
    for (const c of this.clouds) {
      c.position.x += dt * 2
      if (c.position.x > 1100) c.position.x = -1100
    }
  }

  private syncJet(): void {
    const { root, body, flame } = this.jet
    root.position.set(this.flight.pos.x, this.flight.pos.y, this.flight.pos.z)
    root.rotation.order = 'YXZ'
    root.rotation.set(this.flight.pitch, this.flight.yaw, 0)
    body.rotation.z = -this.flight.roll
    const boost01 = (this.flight.speed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)
    flame.scale.set(1, 0.8 + boost01 * 1.6 + Math.random() * 0.25, 1)
    ;(flame.material as THREE.MeshBasicMaterial).color.set(boost01 > 0.3 ? '#7ae8ff' : '#ffb340')
    audio.setEngine(Math.max(0, boost01))
  }

  private updateArrow(): void {
    const p = this.progress
    const g = this.mission.goal
    const jp = this.jetPos(tmpA)
    let target: THREE.Vector3 | null = null
    let best = Infinity
    const pick = (v: THREE.Vector3): void => {
      const d = v.distanceToSquared(jp)
      if (d < best) {
        best = d
        target = v
      }
    }
    if ((g.stars ?? 0) > p.stars) for (const pk of this.pickups) if (pk.kind === 'star' && pk.active) pick(pk.obj.position)
    if (!target && (g.blimps ?? 0) > p.blimps) for (const b of this.blimps) if (b.alive) pick(b.model.root.position)
    if (!target && (g.rings ?? 0) > p.rings) for (const r of this.rings) if (r.active) pick(r.pos)
    if (!target && p.fuel < 30) for (const pk of this.pickups) if (pk.kind === 'fuel' && pk.active) pick(pk.obj.position)

    const tgt = target as THREE.Vector3 | null
    this.arrow.visible = tgt !== null && best > 30 * 30
    if (!tgt) return
    const f = forward(this.flight)
    this.arrow.position.set(jp.x + f.x * 9, jp.y + 4, jp.z + f.z * 9)
    const t: THREE.Vector3 = tgt
    const dx = t.x - this.arrow.position.x
    const dz = t.z - this.arrow.position.z
    this.arrow.rotation.y = Math.atan2(-dx, -dz)
    // Tipped forward so the chase camera sees its face; a slight lift hints "target is above".
    this.arrow.rotation.x = 0.95 + THREE.MathUtils.clamp((t.y - jp.y) / 120, -0.3, 0.3)
    this.arrow.scale.setScalar(1 + Math.sin(p.time * 6) * 0.08)
  }

  private updateCamera(dt: number): void {
    const f = forward(this.flight)
    const jp = this.jetPos(tmpA)
    const back = 15 + (this.flight.speed - BASE_SPEED) * 0.12
    const desired = tmpB.set(jp.x - f.x * back, jp.y - f.y * back * 0.6 + 5.5, jp.z - f.z * back)
    const k = 1 - Math.exp(-6 * dt)
    this.camera.position.lerp(desired, k)
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt)
      const s = this.shake * 1.5
      this.camera.position.x += (Math.random() - 0.5) * s
      this.camera.position.y += (Math.random() - 0.5) * s
    }
    this.camera.lookAt(jp.x + f.x * 12, jp.y + f.y * 12 + 1.5, jp.z + f.z * 12)
    const baseFov = (this.camera.userData.baseFov as number | undefined) ?? 62
    const fov = baseFov + ((this.flight.speed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)) * 14
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }
}
