<script setup lang="ts">
import type { Project } from '~/models'
import { folderItems, type FolderItem } from '~/services/FolderStructure'
import { draggedItem, startItemDrag } from '~/services/ItemDrag'
const props = defineProps<{ project: Project; path: string }>()
const emit = defineEmits<{ open: [item: FolderItem]; place: [path: string, key: string, position: number]; createDocument: [path: string]; createFolder: [] }>()
const step = 190
const lanes = computed(() => {
  const children = folderItems(props.project, props.path)
  const folders = children.flatMap(item => item.folder ? [item.folder] : [])
  const current = props.project.folders.find(folder => folder.path === props.path)
  // Loose documents remain reachable, including when navigating into a leaf folder.
  if (current && children.some(item => item.document)) folders.unshift(current)
  return folders.map(folder => {
    const ends: number[] = []
    const points = folderItems(props.project, folder.path).filter(item => folder.path !== props.path || item.document)
      .map((item, index) => ({ item, at: folder.positions[item.key] ?? index }))
      .sort((a, b) => a.at - b.at).map(point => {
        let row = ends.findIndex(end => end <= point.at)
        if (row < 0) row = ends.length
        ends[row] = point.at + 1
        return { ...point, row }
      })
    return { folder, points, height: 190 + Math.max(0, ...points.map(point => point.row)) * 150 }
  })
})
const width = computed(() => Math.max(5, ...lanes.value.flatMap(lane => lane.points.map(point => Math.ceil(point.at) + 2))) * step)
function drop(event: DragEvent, path: string) {
  const key = draggedItem(event, path)
  if (!key) return
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  emit('place', path, key, Math.max(0, Math.min(10000, Math.round((event.clientX - bounds.left - 20) / step))))
}
</script>

<template>
  <div class="space-y-4 min-w-0">
    <p class="text-sm text-muted">Each subfolder is a thread. Drag its items along the line to position them independently.</p>
    <p v-if="!lanes.length" class="text-muted py-8">Add a subfolder to start a thread, or add a document here.</p>
    <div v-else class="overflow-auto rounded-lg border border-default max-h-[65dvh]" tabindex="0" role="region" aria-label="Threads">
      <section v-for="lane in lanes" :key="lane.folder.path" :aria-label="`${lane.folder.name} thread`" class="flex border-b border-default last:border-0" :style="{ width: `${width + 176}px` }">
        <div class="sticky left-0 z-10 w-44 shrink-0 border-r border-default bg-default p-3 space-y-3">
          <CollectionCard :item="{ key: `folder:${lane.folder.name}`, title: lane.folder.name, folder: lane.folder }" compact @open="emit('open', { key: `folder:${lane.folder.name}`, title: lane.folder.name, folder: lane.folder })" />
          <UButton size="sm" variant="soft" icon="i-lucide-plus" :aria-label="`Add document to ${lane.folder.name}`" @click="emit('createDocument', lane.folder.path)">Add document</UButton>
        </div>
        <div class="relative shrink-0" :data-lane-path="lane.folder.path" :style="{ width: `${width}px`, height: `${lane.height}px` }" @dragover.prevent @drop.prevent="drop($event, lane.folder.path)">
          <div class="absolute left-5 right-5 top-[42px] h-px bg-primary" />
          <p v-if="!lane.points.length" class="absolute left-5 top-16 text-sm text-muted">This folder is empty.</p>
          <div v-for="point in lane.points" :key="point.item.key" class="absolute w-40 cursor-grab" :data-item-key="point.item.key" :data-position="point.at" :style="{ left: `${point.at * step + 20}px`, top: `${35 + point.row * 150}px` }" draggable="true" @dragstart="startItemDrag($event, lane.folder.path, point.item.key)">
            <div class="size-4 rounded-full bg-primary border-2 border-default mb-2" />
            <CollectionCard :item="point.item" compact @open="emit('open', point.item)">
              <div class="flex items-center gap-1 mt-2">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-left" :aria-label="`Move ${point.item.title} left`" :disabled="point.at <= 0" @click="emit('place', lane.folder.path, point.item.key, Math.max(0, point.at - 1))" />
                <span class="text-xs text-muted">{{ Number((point.at + 1).toFixed(2)) }}</span>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-right" :aria-label="`Move ${point.item.title} right`" :disabled="point.at >= 10000" @click="emit('place', lane.folder.path, point.item.key, Math.min(10000, point.at + 1))" />
              </div>
            </CollectionCard>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
