<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { audio } from '../game/audio'
import { Game, type GameEvent, type GameResult, type HudSnapshot } from '../game/Game'
import { Input } from '../game/input'
import type { MissionDef } from '../game/missions'
import { logError } from '../log'
import { saveBest, type Progress } from '../store/progress'
import type { Settings } from '../store/settings'
import Joystick from './Joystick.vue'

const props = defineProps<{ mission: MissionDef; settings: Settings; hasNext: boolean }>()
const emit = defineEmits<{ progress: [Progress]; retry: []; next: []; exit: [] }>()

interface Toast {
  id: number
  text: string
  kind: GameEvent
}

const canvas = ref<HTMLCanvasElement | null>(null)
const hud = shallowRef<HudSnapshot | null>(null)
const toasts = ref<Toast[]>([])
const paused = ref(false)
const result = shallowRef<GameResult | null>(null)
const intro = ref(true)
const input = new Input()
let game: Game | null = null
let toastId = 0

const LABELS: Record<GameEvent, string> = {
  star: '★ Star!',
  ring: 'Ring!',
  fuel: '⛽ Fuel',
  boost: '⚡ BOOST!',
  blimp: '💥 POP!',
  hit: 'Ouch!',
  bump: 'Bonk!',
  lowfuel: 'Low fuel! Grab a red balloon 🎈',
  bounds: 'Turning back!',
}

function onEvent(kind: GameEvent, label?: string): void {
  const id = ++toastId
  toasts.value = [...toasts.value.slice(-3), { id, kind, text: label ? `${LABELS[kind]} ${label}` : LABELS[kind] }]
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), kind === 'lowfuel' ? 2200 : 1100)
  if (kind === 'hit' || kind === 'bump') navigator.vibrate?.(60)
}

function onEnd(r: GameResult): void {
  if (r.won && r.rating > 0) emit('progress', saveBest(props.mission.id, r.rating as 1 | 2 | 3))
  setTimeout(() => (result.value = r), r.won ? 900 : 600)
}

function togglePause(): void {
  if (!game || result.value) return
  paused.value = !paused.value
  if (paused.value) game.pause()
  else {
    input.recalibrate()
    game.resume()
  }
}

function onVisibility(): void {
  if (document.hidden && game && !paused.value && !result.value) togglePause()
}

onMounted(() => {
  if (!canvas.value) return
  input.invertPitch = props.settings.invertPitch
  input.attach()
  if (props.settings.tilt) input.enableTilt()
  try {
    game = new Game(canvas.value, props.mission, input, { onHud: (s) => (hud.value = s), onEvent, onEnd })
    game.start()
    audio.resume()
  } catch (e) {
    logError('play.mount', e)
  }
  setTimeout(() => (intro.value = false), 2600)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  input.detach()
  game?.dispose()
  game = null
})

const goalChips = computed(() => {
  const g = props.mission.goal
  const h = hud.value
  const chips: { icon: string; have: number; need: number }[] = []
  if (g.stars) chips.push({ icon: '★', have: h?.stars ?? 0, need: g.stars })
  if (g.rings) chips.push({ icon: '◎', have: h?.rings ?? 0, need: g.rings })
  if (g.blimps) chips.push({ icon: '💥', have: h?.blimps ?? 0, need: g.blimps })
  return chips
})

const fuelColor = computed(() => {
  const f = hud.value?.fuel ?? 100
  return f < 25 ? 'var(--tomato)' : f < 50 ? 'var(--orange)' : 'var(--lime)'
})
const boostReady = computed(() => (hud.value?.boostMeter ?? 0) >= 34)
const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
</script>

<template>
  <div class="play" :class="{ danger: hud?.danger, lowfuel: (hud?.fuel ?? 100) < 25 }">
    <canvas ref="canvas" />

    <div class="hud safe">
      <div class="top">
        <div class="fuel">
          <span class="icon">⛽</span>
          <div class="bar"><div class="fill" :style="{ width: `${hud?.fuel ?? 100}%`, background: fuelColor }" /></div>
        </div>
        <div class="goals">
          <div v-for="c in goalChips" :key="c.icon" class="chip" :class="{ done: c.have >= c.need }">
            {{ c.icon }} {{ Math.min(c.have, c.need) }}/{{ c.need }}
          </div>
          <div v-if="hud?.timeLeft != null" class="chip" :class="{ hurry: hud.timeLeft < 15 }">⏱ {{ Math.ceil(hud.timeLeft) }}</div>
        </div>
        <div class="right">
          <div class="score">{{ (hud?.score ?? 0).toLocaleString() }}</div>
          <button class="pause" aria-label="Pause" @click="togglePause">❚❚</button>
        </div>
      </div>
      <div v-if="hud?.lock" class="lock">🎯 LOCKED</div>
      <div v-if="hud && hud.combo > 1" class="combo">COMBO x{{ hud.combo }}</div>
    </div>

    <div class="toasts">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}</div>
    </div>

    <div v-if="intro && !result" class="intro">
      <div class="panel">
        <div class="mname">{{ mission.name }}</div>
        <div>{{ mission.tagline }}</div>
        <div class="small">Follow the yellow arrow ➜</div>
      </div>
    </div>

    <Joystick v-if="!settings.tilt" @move="(x, y) => input.setStick(x, y)" />
    <button
      class="boost"
      :class="{ ready: boostReady, active: hud?.boosting }"
      @pointerdown.prevent="input.requestBoost()"
    >
      <span>⚡</span>
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" :style="{ strokeDashoffset: 289 - (289 * (hud?.boostMeter ?? 0)) / 100 }" /></svg>
    </button>

    <div v-if="paused" class="overlay">
      <div class="panel menu">
        <h3>Paused</h3>
        <button class="btn" @click="togglePause">Resume</button>
        <button class="btn secondary" @click="emit('retry')">Restart</button>
        <button class="btn secondary" @click="emit('exit')">Missions</button>
      </div>
    </div>

    <div v-if="result" class="overlay">
      <div class="panel menu">
        <h3>{{ result.won ? 'Mission complete!' : 'Out of fuel!' }}</h3>
        <div v-if="result.won" class="bigstars">
          <span v-for="s in 3" :key="s" :class="{ got: result.rating >= s }" :style="{ animationDelay: `${s * 0.2}s` }">★</span>
        </div>
        <div v-else class="sad">😵‍💫</div>
        <div class="stats">⏱ {{ fmt(result.progress.time) }} · Score {{ result.score.toLocaleString() }}</div>
        <button v-if="result.won && hasNext" class="btn" @click="emit('next')">Next mission</button>
        <button class="btn" :class="{ secondary: result.won }" @click="emit('retry')">{{ result.won ? 'Play again' : 'Try again' }}</button>
        <button class="btn secondary" @click="emit('exit')">Missions</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play { position: fixed; inset: 0; overflow: hidden; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.play::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 0 0 0 transparent;
  transition: box-shadow 0.2s;
}
.play.danger::after { box-shadow: inset 0 0 60px 10px rgba(255, 60, 140, 0.55); animation: blink 0.5s infinite alternate; }
.play.lowfuel .fuel .bar { animation: blink 0.4s infinite alternate; }

.hud { position: absolute; inset: 0; pointer-events: none; }
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.fuel { display: flex; align-items: center; gap: 6px; }
.icon { font-size: 22px; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.2)); }
.bar { width: min(32vw, 200px); height: 18px; border-radius: 999px; background: rgba(255, 255, 255, 0.55); border: 3px solid #fff; overflow: hidden; }
.fill { height: 100%; border-radius: 999px; transition: width 0.15s linear, background 0.3s; }
.goals { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  font-weight: 800;
  font-size: 17px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.15);
}
.chip.done { background: var(--lime); }
.chip.hurry { background: var(--tomato); color: #fff; }
.right { display: flex; align-items: center; gap: 10px; }
.score { color: #fff; font-weight: 900; font-size: 22px; text-shadow: 0 3px 0 var(--ink); }
.pause {
  pointer-events: auto;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}
.lock, .combo {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-weight: 900;
  color: #fff;
  text-shadow: 0 3px 0 var(--ink);
}
.lock { top: calc(64px + env(safe-area-inset-top)); color: #ff3b5c; text-shadow: 0 2px 0 #fff; }
.combo { top: calc(92px + env(safe-area-inset-top)); font-size: 22px; color: var(--mint); }

.toasts {
  position: absolute;
  top: 38%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}
.toast {
  font-weight: 900;
  font-size: 26px;
  color: #fff;
  text-shadow: 0 3px 0 var(--ink);
  white-space: nowrap;
  animation: pop 1.1s ease-out forwards;
}
.toast.star { color: var(--sun); }
.toast.ring { color: var(--mint); }
.toast.fuel { color: #ff9fb0; }
.toast.boost { color: var(--lime); }
.toast.blimp { color: var(--grape); }
.toast.hit, .toast.bump { color: var(--tomato); }
.toast.lowfuel { font-size: 20px; animation-duration: 2.2s; }

.intro { position: absolute; left: 0; right: 0; top: 22%; display: flex; justify-content: center; pointer-events: none; animation: fadeout 2.6s forwards; }
.intro .panel { padding: 14px 26px; text-align: center; font-weight: 700; }
.mname { font-size: 28px; font-weight: 900; color: var(--sky-deep); }
.small { font-size: 14px; opacity: 0.7; margin-top: 4px; }

.boost {
  position: absolute;
  right: max(28px, env(safe-area-inset-right));
  bottom: max(28px, env(safe-area-inset-bottom));
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  display: grid;
  place-items: center;
  font-size: 40px;
  touch-action: none;
  transition: transform 0.1s, background 0.2s;
}
.boost.ready { background: var(--sun); box-shadow: 0 5px 0 #c99a00; }
.boost.active { transform: scale(1.1); background: var(--lime); }
.boost:active { transform: scale(0.94); }
.boost span { position: relative; z-index: 1; }
.boost svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.boost circle { fill: none; stroke: #fff; stroke-width: 7; stroke-linecap: round; stroke-dasharray: 289; transition: stroke-dashoffset 0.15s; }

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(29, 42, 68, 0.35);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}
.menu { padding: 22px 30px; display: flex; flex-direction: column; align-items: stretch; gap: 14px; min-width: 260px; text-align: center; max-height: 92vh; overflow: auto; }
.menu h3 { margin: 0; font-size: 28px; }
.bigstars { font-size: 56px; color: #d5dbe6; line-height: 1; }
.bigstars span { display: inline-block; animation: starpop 0.5s backwards; }
.bigstars .got { color: var(--sun); text-shadow: 0 4px 0 #c99a00; }
.sad { font-size: 50px; }
.stats { font-weight: 700; opacity: 0.8; }

@keyframes pop {
  0% { transform: scale(0.4); opacity: 0; }
  15% { transform: scale(1.15); opacity: 1; }
  30% { transform: scale(1); }
  80% { opacity: 1; }
  100% { transform: translateY(-40px); opacity: 0; }
}
@keyframes blink { from { opacity: 1; } to { opacity: 0.45; } }
@keyframes fadeout { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes starpop { from { transform: scale(0) rotate(-90deg); } to { transform: scale(1) rotate(0); } }
</style>
