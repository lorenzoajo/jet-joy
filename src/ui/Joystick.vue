<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ move: [x: number, y: number] }>()

const RADIUS = 56
const active = ref(false)
const base = ref({ x: 0, y: 0 })
const knob = ref({ x: 0, y: 0 })
let pointerId: number | null = null

function down(e: PointerEvent): void {
  if (pointerId !== null) return
  pointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  base.value = { x: e.clientX, y: e.clientY }
  knob.value = { x: 0, y: 0 }
  active.value = true
}

function move(e: PointerEvent): void {
  if (e.pointerId !== pointerId) return
  let dx = e.clientX - base.value.x
  let dy = e.clientY - base.value.y
  const d = Math.hypot(dx, dy)
  if (d > RADIUS) {
    // Drag the base along so the thumb never "falls off" the stick.
    const over = d - RADIUS
    base.value = { x: base.value.x + (dx / d) * over, y: base.value.y + (dy / d) * over }
    dx = (dx / d) * RADIUS
    dy = (dy / d) * RADIUS
  }
  knob.value = { x: dx, y: dy }
  emit('move', dx / RADIUS, -dy / RADIUS)
}

function up(e: PointerEvent): void {
  if (e.pointerId !== pointerId) return
  pointerId = null
  active.value = false
  knob.value = { x: 0, y: 0 }
  emit('move', 0, 0)
}
</script>

<template>
  <div class="zone" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
    <div v-if="!active" class="hint">Drag to steer</div>
    <div v-else class="base" :style="{ left: `${base.x}px`, top: `${base.y}px` }">
      <div class="knob" :style="{ transform: `translate(${knob.x}px, ${knob.y}px)` }" />
    </div>
  </div>
</template>

<style scoped>
.zone { position: absolute; left: 0; top: 0; bottom: 0; width: 55%; touch-action: none; }
.hint {
  position: absolute;
  left: max(28px, env(safe-area-inset-left));
  bottom: max(28px, env(safe-area-inset-bottom));
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  color: #fff;
  font-weight: 800;
  pointer-events: none;
}
.base {
  position: fixed;
  width: 120px;
  height: 120px;
  margin: -60px 0 0 -60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 4px solid rgba(255, 255, 255, 0.7);
  pointer-events: none;
}
.knob {
  position: absolute;
  left: 30px;
  top: 30px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
}
</style>
