<script setup lang="ts">
import type { DocumentSummary, Folder, ProjectSnapshot } from '~/models'
import { folderIcon, folderItems, folderPath, kindIcons } from '~/services/FolderStructure'
import { draggedItem, startItemDrag } from '~/services/ItemDrag'
const props = defineProps<{ project: ProjectSnapshot; folderId: string; selectedFolder: string; selectedId: string }>()
const emit = defineEmits<{ folder: [folder: Folder]; document: [doc: DocumentSummary]; reorder: [folderId: string, from: string, to: string] }>()
const collapsed = ref(new Set<string>())
const items = computed(() => folderItems(props.project, props.folderId))
function toggle(id: string) { collapsed.value.has(id) ? collapsed.value.delete(id) : collapsed.value.add(id) }
function drop(event: DragEvent, to: string) {
  const from = draggedItem(event, props.folderId)
  if (from) emit('reorder', props.folderId, from, to)
}
</script>

<template>
  <ul class="space-y-1" aria-label="Project folders">
    <li v-for="item in items" :key="item.id" :data-item-id="item.id" draggable="true" @dragstart.stop="startItemDrag($event, folderId, item.id)" @dragover.prevent.stop @drop.prevent.stop="drop($event, item.id)">
      <template v-if="item.folder">
        <div class="flex items-center gap-1 rounded-md" :class="{ 'bg-elevated': selectedFolder === item.folder.id }">
          <UButton color="neutral" variant="ghost" size="xs" :icon="collapsed.has(item.folder.id) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" :aria-label="`${collapsed.has(item.folder.id) ? 'Expand' : 'Collapse'} ${item.title}`" :aria-expanded="!collapsed.has(item.folder.id)" @click="toggle(item.folder.id)" />
          <UButton color="neutral" variant="ghost" :icon="folderIcon(project, item.folder)" class="flex-1 min-w-0 justify-start" :aria-label="`Folder ${folderPath(project, item.folder.id)}`" @click="emit('folder', item.folder)"><span class="truncate">{{ item.title }}</span><UIcon v-if="item.folder.pinnedView" name="i-lucide-pin" class="size-3 ml-auto shrink-0" /></UButton>
        </div>
        <FolderTree v-if="!collapsed.has(item.folder.id)" class="ml-4 pl-2 border-l border-default" :project="project" :folder-id="item.folder.id" :selected-folder="selectedFolder" :selected-id="selectedId" @folder="emit('folder', $event)" @document="emit('document', $event)" @reorder="(folderId, from, to) => emit('reorder', folderId, from, to)" />
      </template>
      <UButton v-else color="neutral" :variant="selectedId === item.document.id ? 'soft' : 'ghost'" :icon="kindIcons[item.document.kind]" class="w-full justify-start" :aria-label="`Open ${item.title}`" @click="emit('document', item.document)"><span class="truncate">{{ item.title }}</span></UButton>
    </li>
  </ul>
</template>
