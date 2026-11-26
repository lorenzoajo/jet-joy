import { registerSW } from 'virtual:pwa-register'
import { logError } from './log'

const CHECK_INTERVAL_MS = 30 * 60 * 1000

let updateReady = false
let canApplyNow = (): boolean => true
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null

function tryApply(): void {
  if (!updateReady || !applyUpdate || !canApplyNow()) return
  updateReady = false
  applyUpdate(true).catch((e: unknown) => logError('pwa.apply', e))
}

/**
 * Registers the service worker in "prompt" mode so we decide when to swap versions:
 * immediately when idle in menus, deferred while a mission is being played.
 */
export function setupPwa(isSafe: () => boolean): { notifySafe: () => void } {
  canApplyNow = isSafe
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true
      tryApply()
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = (): void => {
        if (navigator.onLine) reg.update().catch((e: unknown) => logError('pwa.check', e))
      }
      setInterval(check, CHECK_INTERVAL_MS)
      // Home-screen apps on iOS resume from memory rather than relaunching.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('online', check)
    },
    onRegisterError(e: unknown) {
      logError('pwa.register', e)
    },
  })
  return { notifySafe: tryApply }
}
