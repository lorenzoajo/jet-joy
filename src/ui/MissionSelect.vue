<script setup lang="ts">
import { MISSIONS } from '../game/missions'
import type { Progress } from '../store/progress'

const props = defineProps<{ progress: Progress }>()
const emit = defineEmits<{ play: [index: number]; back: [] }>()

const unlocked = (i: number): boolean => i === 0 || props.progress[MISSIONS[i - 1]?.id ?? ''] !== undefined
const goalText = (i: number): string => {
  const g = MISSIONS[i]?.goal ?? {}
  return [g.stars && `★ ${g.stars}`, g.rings && `◎ ${g.rings}`, g.blimps && `💥 ${g.blimps}`].filter(Boolean).join('  ')
}
</script>

<template>
  <main class="select safe">
    <header>
      <button class="back" @click="emit('back')">‹</button>
      <h2>Missions</h2>
    </header>
    <div class="grid">
      <button
        v-for="(m, i) in MISSIONS"
        :key="m.id"
        class="card panel"
        :class="{ locked: !unlocked(i) }"
        :disabled="!unlocked(i)"
        @click="emit('play', i)"
      >
        <div class="num">{{ unlocked(i) ? i + 1 : '🔒' }}</div>
        <div class="name">{{ m.name }}</div>
        <div class="desc">{{ m.tagline }}</div>
        <div class="goal">{{ goalText(i) }}<span v-if="m.timeLimit"> ⏱ {{ m.timeLimit }}s</span></div>
        <div class="stars">
          <span v-for="s in 3" :key="s" :class="{ got: (progress[m.id] ?? 0) >= s }">★</span>
        </div>
      </button>
    </div>
  </main>
</template>

<style scoped>
.select {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  touch-action: pan-y;
  background: linear-gradient(180deg, #2a6fe0 0%, #4fb3ff 100%);
}
header { display: flex; align-items: center; gap: 12px; color: #fff; }
h2 { margin: 0; font-size: 34px; text-shadow: 0 4px 0 #1d2a44; }
.back { width: 48px; height: 48px; border-radius: 50%; background: #fff; color: var(--ink); font-size: 30px; line-height: 1; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
  padding: 18px 0 24px;
}
.card {
  text-align: left;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.1s;
}
.card:active { transform: scale(0.97); }
.card.locked { opacity: 0.55; }
.num {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--sky-deep); color: #fff;
  display: grid; place-items: center; font-size: 20px;
}
.name { font-size: 22px; }
.desc { font-weight: 600; font-size: 14px; opacity: 0.75; }
.goal { font-size: 15px; color: var(--sky-deep); }
.stars { font-size: 26px; color: #d5dbe6; letter-spacing: 2px; }
.stars .got { color: var(--sun); text-shadow: 0 2px 0 #c99a00; }
</style>
