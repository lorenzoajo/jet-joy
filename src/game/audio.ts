import { logError } from '../log'

export type Sfx = 'star' | 'ring' | 'fuel' | 'boost' | 'shoot' | 'pop' | 'hit' | 'bump' | 'win' | 'lose' | 'warn'

const LOOP_FADE = 0.05

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
interface JetEngine {
  sources: AudioScheduledSourceNode[]
  bus: GainNode
  roarFilter: BiquadFilterNode
  roarGain: GainNode
  hissFilter: BiquadFilterNode
  hissGain: GainNode
  whines: OscillatorNode[]
  whineGain: GainNode
  burnerGain: GainNode
}

export class SoundBoard {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engine: JetEngine | null = null
  private noise: AudioBuffer | null = null
  private brown: AudioBuffer | null = null
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
        this.brown = this.makeBrownNoise(this.ctx)
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
    const ctx = this.ctx
    const out = this.master
    if (!ctx || !out || this.engine || !this.noise || !this.brown) return
    const t = ctx.currentTime
    const sources: AudioScheduledSourceNode[] = []
    const loop = (buf: AudioBuffer): AudioBufferSourceNode => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      // Matches the 50 ms crossfade baked into the buffers: the faded tail flows into this point.
      src.loopStart = LOOP_FADE
      src.loopEnd = buf.duration
      // Random offsets so layers sharing a buffer don't phase-lock.
      src.start(t, Math.random() * buf.duration)
      sources.push(src)
      return src
    }
    const filter = (type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode => {
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      return f
    }
    const gain = (v: number): GainNode => {
      const g = ctx.createGain()
      g.gain.value = v
      return g
    }

    const bus = gain(0)
    bus.connect(out)
    // Spool-up instead of a hard start.
    bus.gain.setTargetAtTime(1, t, 0.35)

    const roarFilter = filter('lowpass', 700)
    const roarGain = gain(0.22)
    loop(this.brown).connect(roarFilter).connect(roarGain).connect(bus)

    const hissFilter = filter('bandpass', 4000, 0.8)
    const hissGain = gain(0.025)
    loop(this.noise).connect(filter('highpass', 1800)).connect(hissFilter).connect(hissGain).connect(bus)

    const whineGain = gain(0.008)
    const whines = [2100, 2113].map((f) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(whineGain)
      o.start(t)
      sources.push(o)
      return o
    })
    whineGain.connect(bus)

    const burnerGain = gain(0)
    loop(this.brown).connect(filter('lowpass', 140)).connect(burnerGain).connect(bus)

    this.engine = { sources, bus, roarFilter, roarGain, hissFilter, hissGain, whines, whineGain, burnerGain }
  }

  stopEngine(): void {
    const e = this.engine
    if (!e || !this.ctx) return
    this.engine = null
    const t = this.ctx.currentTime
    e.bus.gain.setTargetAtTime(0, t, 0.15)
    for (const s of e.sources) {
      try {
        s.stop(t + 0.8)
      } catch (err) {
        logError('audio.stopEngine', err)
      }
    }
    setTimeout(() => e.bus.disconnect(), 1000)
  }

  /** speed01: 0 = cruise, 1 = full boost. */
  setEngine(speed01: number): void {
    const e = this.engine
    if (!this.ctx || !e) return
    const t = this.ctx.currentTime
    const s = Math.max(0, Math.min(1, speed01))
    e.roarFilter.frequency.setTargetAtTime(700 + s * 900, t, 0.15)
    e.roarGain.gain.setTargetAtTime(0.22 + s * 0.15, t, 0.15)
    e.hissFilter.frequency.setTargetAtTime(4000 + s * 2000, t, 0.15)
    e.hissGain.gain.setTargetAtTime(0.025 + s * 0.03, t, 0.15)
    e.whines.forEach((o, i) => o.frequency.setTargetAtTime(2100 + i * 13 + s * 700, t, 0.4))
    e.whineGain.gain.setTargetAtTime(0.008 + s * 0.006, t, 0.2)
    // Afterburner only really kicks in on boost.
    e.burnerGain.gain.setTargetAtTime(Math.max(0, s - 0.2) * 0.45, t, 0.12)
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
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  /** Brown (random-walk) noise: the deep, smooth roar of a jet exhaust. */
  private makeBrownNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 3.5
    }
    // Crossfade the tail into the head so the loop point doesn't click.
    const fade = Math.floor(ctx.sampleRate * LOOP_FADE)
    for (let i = 0; i < fade; i++) {
      const k = i / fade
      const tail = d.length - fade + i
      d[tail] = (d[tail] ?? 0) * (1 - k) + (d[i] ?? 0) * k
    }
    return buf
  }
}

export const audio = new SoundBoard()
