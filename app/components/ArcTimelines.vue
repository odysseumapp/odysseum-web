<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DocumentSummary } from '../models'

const props = defineProps<{ arcs: DocumentSummary[]; beats: DocumentSummary[]; busy: boolean }>()
const emit = defineEmits<{
  createBeat: [arc: string, title: string, position: number];
  create: []; open: [document: DocumentSummary];
  place: [document: DocumentSummary, arc: string, position: number | null];
}>()
const step = 190
const adding = ref<DocumentSummary | null>(null)
const chosen = ref('')
const newBeat = ref(true)
const beatTitle = ref('')
const position = ref(1)
const dragged = ref<{ id: string; arc: string } | null>(null)
const positions = (doc: DocumentSummary) => doc.arcPositions ?? {}
const members = (arc: string) => props.beats.filter(doc => positions(doc)[arc] !== undefined)
  .sort((a, b) => positions(a)[arc]! - positions(b)[arc]! || a.id.localeCompare(b.id))
const available = computed(() => props.beats.filter(doc => adding.value && positions(doc)[adding.value.id] === undefined))
const columns = computed(() => Math.max(5, ...props.beats.flatMap(doc => Object.values(positions(doc)).map(value => Math.ceil(value) + 2))))
const width = computed(() => columns.value * step)
// Stack coincident points from external metadata without hiding either document.
function points(arc: string) {
  const ends: number[] = []
  return members(arc).map(document => {
    const at = positions(document)[arc]!
    let row = ends.findIndex(end => end <= at)
    if (row < 0) row = ends.length
    ends[row] = at + 1
    return { document, at, row }
  })
}
const lanes = computed(() => props.arcs.map(arc => {
  const items = points(arc.id)
  return { arc, items, height: 162 + Math.max(0, ...items.map(item => item.row)) * 116 }
}))
function add(arc: DocumentSummary) {
  chosen.value = ''
  beatTitle.value = ''
  newBeat.value = true
  position.value = Math.min(10001, Math.floor(Math.max(-1, ...members(arc.id).map(doc => positions(doc)[arc.id]!))) + 2)
  adding.value = arc
}
function attach() {
  if (!adding.value || !Number.isFinite(position.value) || position.value < 1 || position.value > 10001) return
  if (newBeat.value) {
    if (!beatTitle.value.trim()) return
    emit('createBeat', adding.value.id, beatTitle.value.trim(), position.value - 1)
  } else {
    const document = props.beats.find(doc => doc.id === chosen.value)
    if (!document) return
    emit('place', document, adding.value.id, position.value - 1)
  }
  adding.value = null
}
function drop(event: DragEvent, arc: string) {
  event.preventDefault()
  if (!dragged.value || dragged.value.arc !== arc || props.busy) return
  const document = props.beats.find(doc => doc.id === dragged.value!.id)
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const at = Math.max(0, Math.min(10000, Math.round((event.clientX - bounds.left - 20) / step)))
  if (document) emit('place', document, arc, at)
  dragged.value = null
}
function drag(event: DragEvent, document: DocumentSummary, arc: string) {
  dragged.value = { id: document.id, arc }
  event.dataTransfer?.setData('text/plain', document.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <div class="space-y-4 min-w-0">
    <header class="flex justify-between gap-4 items-center"><div><h2 class="text-xl font-semibold">Story arcs</h2><p class="text-sm text-muted">Each arc has independently positioned beats.</p></div><UButton icon="i-lucide-plus" @click="emit('create')">New arc</UButton></header>
    <p v-if="!arcs.length" class="text-muted py-8">Create an arc, then add beats along its line.</p>
    <div v-else class="overflow-auto rounded-lg border border-default max-h-[65dvh]" tabindex="0" role="region" aria-label="Story arc timelines">
      <section v-for="lane in lanes" :key="lane.arc.id" :aria-label="`${lane.arc.title} arc`" class="flex border-b border-default last:border-0" :style="{ width: `${width + 176}px` }">
        <div class="sticky left-0 z-10 w-44 shrink-0 border-r border-default bg-default p-4 space-y-3">
          <UButton color="neutral" variant="link" class="p-0 text-left whitespace-normal" :aria-label="`Edit ${lane.arc.title}`" @click="emit('open', lane.arc)">{{ lane.arc.title }}</UButton>
          <p class="text-xs text-muted">{{ lane.items.length }} beats</p>
          <UButton size="sm" variant="soft" icon="i-lucide-plus" :aria-label="`Add beat to ${lane.arc.title}`" :disabled="busy" @click="add(lane.arc)">Add beat</UButton>
        </div>
        <div class="relative shrink-0" :class="{ 'bg-muted': dragged?.arc === lane.arc.id }" :style="{ width: `${width}px`, height: `${lane.height}px` }" @dragover.prevent @drop="drop($event, lane.arc.id)">
          <div class="absolute left-5 right-5 top-[42px] h-px bg-primary" />
          <p v-if="!lane.items.length" class="absolute left-5 top-16 text-sm text-muted">Add the first beat.</p>
          <div v-for="point in lane.items" :key="point.document.id" class="absolute w-40 cursor-grab" :data-document-id="point.document.id" :data-position="point.at" :style="{ left: `${point.at * step + 20}px`, top: `${35 + point.row * 116}px` }" :draggable="!busy" @dragstart="drag($event, point.document, lane.arc.id)" @dragend="dragged = null">
            <div class="size-4 rounded-full bg-primary border-2 border-default" />
            <div class="mt-2 rounded-md border border-default bg-default p-2 space-y-1">
              <span class="block text-xs text-muted">Position {{ Number((point.at + 1).toFixed(2)) }}</span>
              <UButton color="neutral" variant="link" class="p-0 max-w-full" :aria-label="`Open ${point.document.title}`" @click="emit('open', point.document)"><span class="truncate">{{ point.document.title }}</span></UButton>
              <div class="flex gap-1">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :aria-label="`Move ${point.document.title} left on ${lane.arc.title}`" :disabled="busy || point.at <= 0" @click="emit('place', point.document, lane.arc.id, Math.max(0, point.at - 1))" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-right" :aria-label="`Move ${point.document.title} right on ${lane.arc.title}`" :disabled="busy || point.at >= 10000" @click="emit('place', point.document, lane.arc.id, Math.min(10000, point.at + 1))" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="ml-auto" :aria-label="`Remove ${point.document.title} from ${lane.arc.title}`" :disabled="busy" @click="emit('place', point.document, lane.arc.id, null)" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    <p v-if="arcs.length" class="text-xs text-muted">Drag beats or use their arrow buttons to change position. A beat can appear on multiple arcs.</p>
    <UModal :open="!!adding" :title="`Add beat to ${adding?.title ?? 'arc'}`" description="Create a beat document or place an existing beat on this arc." @update:open="value => { if (!value) adding = null }">
      <template #body>
        <form class="space-y-4" @submit.prevent="attach">
          <div class="flex gap-2"><UButton :variant="newBeat ? 'solid' : 'outline'" @click="newBeat = true">New beat</UButton><UButton :variant="!newBeat ? 'solid' : 'outline'" @click="newBeat = false">Existing beat</UButton></div>
          <UFormField v-if="newBeat" label="Beat title" required><UInput v-model="beatTitle" maxlength="200" autofocus required class="w-full" /></UFormField>
          <UFormField v-else label="Beat" required><USelect v-model="chosen" :items="available.map(doc => ({ label: doc.title, value: doc.id }))" placeholder="Select a beat" class="w-full" /></UFormField>
          <UFormField label="Position" required><UInput v-model.number="position" type="number" min="1" max="10001" step="1" required class="w-full" /></UFormField>
          <UButton type="submit" :disabled="busy || (newBeat ? !beatTitle.trim() : !chosen)">{{ newBeat ? 'Create beat' : 'Add to arc' }}</UButton>
        </form>
      </template>
    </UModal>
  </div>
</template>
