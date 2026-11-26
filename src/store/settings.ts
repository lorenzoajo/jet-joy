import { logError } from '../log'

export interface Settings {
  sound: boolean
  tilt: boolean
  invertPitch: boolean
}

const KEY = 'jet-joy:settings:v1'
const DEFAULTS: Settings = { sound: true, tilt: false, invertPitch: false }

export function loadSettings(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>
    return {
      sound: typeof p.sound === 'boolean' ? p.sound : DEFAULTS.sound,
      tilt: typeof p.tilt === 'boolean' ? p.tilt : DEFAULTS.tilt,
      invertPitch: typeof p.invertPitch === 'boolean' ? p.invertPitch : DEFAULTS.invertPitch,
    }
  } catch (e) {
    logError('settings.load', e)
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: Settings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s))
  } catch (e) {
    logError('settings.save', e)
  }
}
