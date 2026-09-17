<script setup lang="ts">
import type { DocumentSummary, FolderSummary, Project } from '~/models'
import { folderIcon, folderItems, kindIcons } from '~/services/FolderStructure'
import { draggedItem, startItemDrag } from '~/services/ItemDrag'
const props = defineProps<{ project: Project; path: string; selectedFolder: string; selectedId: string }>()
const emit = defineEmits<{ folder: [folder: FolderSummary]; document: [doc: DocumentSummary]; reorder: [path: string, from: string, to: string] }>()
const collapsed = ref(new Set<string>())
const items = computed(() => folderItems(props.project, props.path))
function toggle(path: string) { collapsed.value.has(path) ? collapsed.value.delete(path) : collapsed.value.add(path) }
function drop(event: DragEvent, to: string) {
  const from = draggedItem(event, props.path)
  if (from) emit('reorder', props.path, from, to)
}
</script>

<template>
  <ul class="space-y-1" :aria-label="path || 'Project folders'">
    <li v-for="item in items" :key="item.key" :data-item-key="item.key" draggable="true" @dragstart.stop="startItemDrag($event, path, item.key)" @dragover.prevent.stop @drop.prevent.stop="drop($event, item.key)">
      <template v-if="item.folder">
        <div class="flex items-center gap-1 rounded-md" :class="{ 'bg-elevated': selectedFolder === item.folder.path }">
          <UButton color="neutral" variant="ghost" size="xs" :icon="collapsed.has(item.folder.path) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" :aria-label="`${collapsed.has(item.folder.path) ? 'Expand' : 'Collapse'} ${item.title}`" :aria-expanded="!collapsed.has(item.folder.path)" @click="toggle(item.folder.path)" />
          <UButton color="neutral" variant="ghost" :icon="folderIcon(item.folder.path)" class="flex-1 min-w-0 justify-start" :aria-label="`Folder ${item.folder.path}`" @click="emit('folder', item.folder)"><span class="truncate">{{ item.title }}</span><UIcon v-if="item.folder.pinnedView" name="i-lucide-pin" class="size-3 ml-auto shrink-0" /></UButton>
        </div>
        <FolderTree v-if="!collapsed.has(item.folder.path)" class="ml-4 pl-2 border-l border-default" :project="project" :path="item.folder.path" :selected-folder="selectedFolder" :selected-id="selectedId" @folder="emit('folder', $event)" @document="emit('document', $event)" @reorder="(path, from, to) => emit('reorder', path, from, to)" />
      </template>
      <UButton v-else color="neutral" :variant="selectedId === item.document.id ? 'soft' : 'ghost'" :icon="kindIcons[item.document.kind]" class="w-full justify-start" :aria-label="`Open ${item.title}`" @click="emit('document', item.document)"><span class="truncate">{{ item.title }}</span></UButton>
    </li>
  </ul>
</template>
