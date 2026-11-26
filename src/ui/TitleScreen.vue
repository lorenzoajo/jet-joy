<script setup lang="ts">
import type { Settings } from '../store/settings'

const props = defineProps<{ settings: Settings }>()
const emit = defineEmits<{ start: []; 'update:settings': [Settings] }>()

function toggle(key: keyof Settings): void {
  emit('update:settings', { ...props.settings, [key]: !props.settings[key] })
}
</script>

<template>
  <main class="title safe">
    <div class="cloud c1" />
    <div class="cloud c2" />
    <div class="cloud c3" />
    <div class="hero">
      <div class="plane" aria-hidden="true">✈️</div>
      <h1>Jet<span>Joy</span></h1>
      <p class="tag">Fly. Grab stars. Pop grumpy blimps!</p>
      <button class="btn big" @click="emit('start')">Tap to fly!</button>
    </div>
    <div class="toggles">
      <button :class="{ on: settings.sound }" @click="toggle('sound')">{{ settings.sound ? '🔊' : '🔇' }} Sound</button>
      <button :class="{ on: settings.tilt }" @click="toggle('tilt')">📱 Tilt steer</button>
      <button :class="{ on: settings.invertPitch }" @click="toggle('invertPitch')">↕️ Invert</button>
    </div>
  </main>
</template>

<style scoped>
.title {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: linear-gradient(180deg, #2a6fe0 0%, #4fb3ff 55%, #bfe8ff 100%);
  overflow: hidden;
}
.hero { text-align: center; z-index: 1; }
.plane { font-size: min(64px, 13vh); animation: fly 2.4s ease-in-out infinite; filter: drop-shadow(0 8px 6px rgba(0, 0, 0, 0.25)); }
h1 {
  margin: 0;
  font-size: clamp(44px, min(13vw, 21vh), 120px);
  line-height: 0.95;
  color: #fff;
  letter-spacing: -2px;
  text-shadow: 0 6px 0 #1d2a44, 0 12px 24px rgba(0, 0, 0, 0.25);
  transform: rotate(-4deg);
}
h1 span { color: var(--sun); margin-left: 10px; }
.tag { color: #fff; font-weight: 700; font-size: 18px; margin: 14px 0 22px; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.2); }
.big { font-size: 26px; padding: 18px 44px; animation: pulse 1.4s ease-in-out infinite; }
.toggles { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; z-index: 1; }
.toggles button {
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  color: #fff;
  font-size: 15px;
}
.toggles button.on { background: #fff; color: var(--ink); }
.cloud {
  position: absolute;
  width: 180px;
  height: 60px;
  background: #fff;
  border-radius: 60px;
  opacity: 0.9;
  animation: drift linear infinite;
}
.cloud::before, .cloud::after { content: ''; position: absolute; background: #fff; border-radius: 50%; }
.cloud::before { width: 80px; height: 80px; top: -40px; left: 25px; }
.cloud::after { width: 100px; height: 100px; top: -55px; left: 70px; }
.c1 { top: 15%; animation-duration: 28s; }
.c2 { top: 60%; animation-duration: 40s; animation-delay: -15s; transform: scale(0.7); }
.c3 { top: 80%; animation-duration: 33s; animation-delay: -25s; }
@keyframes drift { from { left: -220px; } to { left: 110%; } }
@keyframes fly { 0%, 100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-14px) rotate(6deg); } }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
</style>
