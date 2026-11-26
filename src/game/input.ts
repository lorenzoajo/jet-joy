import { logError } from '../log'
import type { FlightInput } from './flight'

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v))

/** Merges joystick, keyboard and tilt into a single stick + boost request. */
export class Input {
  private stick = { x: 0, y: 0 }
  private keys = new Set<string>()
  private tilt: { x: number; y: number } | null = null
  private tiltBase: { beta: number; gamma: number } | null = null
  private boostQueued = false
  invertPitch = false

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code)
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.boostQueued = true
  }
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }
  private onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta === null || e.gamma === null) return
    if (!this.tiltBase) this.tiltBase = { beta: e.beta, gamma: e.gamma }
    const angle = screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0
    const db = e.beta - this.tiltBase.beta
    const dg = e.gamma - this.tiltBase.gamma
    // Landscape: steering-wheel tilt maps to beta, forward/back tilt to gamma.
    if (angle === 90) this.tilt = { x: clamp1(db / 28), y: clamp1(-dg / 22) }
    else if (angle === 270 || angle === -90) this.tilt = { x: clamp1(-db / 28), y: clamp1(dg / 22) }
    else this.tilt = { x: clamp1(dg / 28), y: clamp1(-db / 22) }
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.disableTilt()
  }

  setStick(x: number, y: number): void {
    this.stick.x = clamp1(x)
    this.stick.y = clamp1(y)
  }

  requestBoost(): void {
    this.boostQueued = true
  }

  consumeBoost(): boolean {
    const b = this.boostQueued
    this.boostQueued = false
    return b
  }

  /** Call from a user gesture: iOS requires a permission prompt. */
  static async requestTiltPermission(): Promise<boolean> {
    const Ctor = (window as Window & { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent
    if (!Ctor) return false
    if (typeof Ctor.requestPermission !== 'function') return true
    try {
      return (await Ctor.requestPermission()) === 'granted'
    } catch (e) {
      logError('input.tiltPermission', e)
      return false
    }
  }

  enableTilt(): void {
    this.tiltBase = null
    window.addEventListener('deviceorientation', this.onOrientation)
  }

  disableTilt(): void {
    window.removeEventListener('deviceorientation', this.onOrientation)
    this.tilt = null
  }

  recalibrate(): void {
    this.tiltBase = null
  }

  read(): FlightInput {
    const k = this.keys
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0)
    let y = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0)
    if (x === 0 && y === 0) {
      x = this.stick.x
      y = this.stick.y
    }
    if (x === 0 && y === 0 && this.tilt) {
      x = this.tilt.x
      y = this.tilt.y
    }
    return { x, y: this.invertPitch ? -y : y }
  }
}
