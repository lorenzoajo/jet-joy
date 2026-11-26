<script setup lang="ts">
import { computed, ref } from 'vue'
import { audio } from './game/audio'
import { Input } from './game/input'
import { MISSIONS, type MissionDef } from './game/missions'
import { loadProgress, type Progress } from './store/progress'
import { loadSettings, saveSettings, type Settings } from './store/settings'
import MissionSelect from './ui/MissionSelect.vue'
import PlayView from './ui/PlayView.vue'
import TitleScreen from './ui/TitleScreen.vue'

type Screen = 'title' | 'select' | 'play'

const screen = ref<Screen>('title')
const settings = ref<Settings>(loadSettings())
const progress = ref<Progress>(loadProgress())
const missionIndex = ref(0)
const runKey = ref(0)
const mission = computed<MissionDef>(() => MISSIONS[missionIndex.value] ?? MISSIONS[0]!)

audio.enabled = settings.value.sound

// Deep link for quick testing: #play=<mission index>
const deep = /#play=(\d+)/.exec(location.hash)
if (deep) {
  missionIndex.value = Math.min(Number(deep[1]), MISSIONS.length - 1)
  screen.value = 'play'
}

async function updateSettings(next: Settings): Promise<void> {
  if (next.tilt && !settings.value.tilt) next = { ...next, tilt: await Input.requestTiltPermission() }
  settings.value = next
  audio.setEnabled(next.sound)
  saveSettings(next)
}

async function start(): Promise<void> {
  audio.unlock()
  if (settings.value.tilt && !(await Input.requestTiltPermission())) await updateSettings({ ...settings.value, tilt: false })
  screen.value = 'select'
}

function play(i: number): void {
  audio.unlock()
  missionIndex.value = i
  runKey.value++
  screen.value = 'play'
}
</script>

<template>
  <TitleScreen v-if="screen === 'title'" :settings="settings" @start="start" @update:settings="updateSettings" />
  <MissionSelect v-else-if="screen === 'select'" :progress="progress" @play="play" @back="screen = 'title'" />
  <PlayView
    v-else
    :key="runKey"
    :mission="mission"
    :settings="settings"
    :has-next="missionIndex < MISSIONS.length - 1"
    @progress="progress = $event"
    @retry="play(missionIndex)"
    @next="play(missionIndex + 1)"
    @exit="screen = 'select'"
  />
</template>
