import { logError } from '../log'

export type Sfx = 'star' | 'ring' | 'fuel' | 'boost' | 'shoot' | 'pop' | 'hit' | 'bump' | 'win' | 'lose' | 'warn'

type Note = [freq: number, at: number, dur: number]

const MELODIES: Partial<Record<Sfx, { type: OscillatorType; notes: Note[]; vol: number }>> = {
  star: { type: 'triangle', vol: 0.25, notes: [[988, 0, 0.08], [1319, 0.07, 0.08], [1976, 0.14, 0.18]] },
  ring: { type: 'sine', vol: 0.22, notes: [[660, 0, 0.06], [880, 0.05, 0.06], [1100, 0.1, 0.12]] },
  fuel: { type: 'square', vol: 0.08, notes: [[392, 0, 0.07], [523, 0.07, 0.07], [659, 0.14, 0.12]] },
  shoot: { type: 'square', vol: 0.035, notes: [[1400, 0, 0.04]] },
  win: { type: 'triangle', vol: 0.25, notes: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.35]] },
  lose: { type: 'triangle', vol: 0.25, notes: [[440, 0, 0.18], [370, 0.18, 0.18], [294, 0.36, 0.4]] },
  warn: { type: 'square', vol: 0.05, notes: [[880, 0, 0.06], [880, 0.12, 0.06]] },
}

/** Tiny synth: no audio files, everything generated with WebAudio. */
export class SoundBoard {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engine: OscillatorNode | null = null
  private engineGain: GainNode | null = null
  private noise: AudioBuffer | null = null
  enabled = true

  /** Must be called from a user gesture (iOS). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.enabled ? 0.8 : 0
        this.master.connect(this.ctx.destination)
        this.noise = this.makeNoise(this.ctx)
      }
      void this.ctx.resume()
    } catch (e) {
      logError('audio.unlock', e)
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05)
  }

  suspend(): void {
    void this.ctx?.suspend()
  }

  resume(): void {
    void this.ctx?.resume()
  }

  startEngine(): void {
    if (!this.ctx || !this.master || this.engine) return
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 70
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 380
    const gain = this.ctx.createGain()
    gain.gain.value = 0.05
    osc.connect(filter).connect(gain).connect(this.master)
    osc.start()
    this.engine = osc
    this.engineGain = gain
  }

  stopEngine(): void {
    try {
      this.engine?.stop()
    } catch (e) {
      logError('audio.stopEngine', e)
    }
    this.engine?.disconnect()
    this.engine = null
    this.engineGain = null
  }

  /** speed01: 0 = cruise, 1 = full boost. */
  setEngine(speed01: number): void {
    if (!this.ctx || !this.engine || !this.engineGain) return
    const t = this.ctx.currentTime
    this.engine.frequency.setTargetAtTime(65 + speed01 * 55, t, 0.1)
    this.engineGain.gain.setTargetAtTime(0.045 + speed01 * 0.04, t, 0.1)
  }

  play(sfx: Sfx): void {
    const ctx = this.ctx
    const out = this.master
    if (!ctx || !out || !this.enabled) return
    const t = ctx.currentTime
    const mel = MELODIES[sfx]
    if (mel) {
      for (const [f, at, dur] of mel.notes) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = mel.type
        o.frequency.value = f
        g.gain.setValueAtTime(mel.vol, t + at)
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur)
        o.connect(g).connect(out)
        o.start(t + at)
        o.stop(t + at + dur + 0.02)
      }
      return
    }
    // Noise-based effects
    if (!this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    const spec: Record<'boost' | 'pop' | 'hit' | 'bump', [BiquadFilterType, number, number, number, number]> = {
      boost: ['bandpass', 300, 3000, 0.35, 0.6],
      pop: ['lowpass', 2400, 300, 0.4, 0.25],
      hit: ['lowpass', 600, 80, 0.5, 0.35],
      bump: ['lowpass', 400, 60, 0.35, 0.25],
    }
    const s = spec[sfx as keyof typeof spec]
    if (!s) return
    const [type, f0, f1, vol, dur] = s
    filter.type = type
    filter.frequency.setValueAtTime(f0, t)
    filter.frequency.exponentialRampToValueAtTime(f1, t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter).connect(g).connect(out)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }
}

export const audio = new SoundBoard()
