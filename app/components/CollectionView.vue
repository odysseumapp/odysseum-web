<script setup lang="ts">
import type { FolderItem } from '~/services/FolderStructure'
import { draggedItem, startItemDrag } from '~/services/ItemDrag'
defineProps<{ items: FolderItem[]; path: string; view: 'board' | 'outline' }>()
const emit = defineEmits<{ open: [item: FolderItem]; reorder: [path: string, from: string, to: string] }>()
function drop(event: DragEvent, path: string, to: string) {
  const from = draggedItem(event, path)
  if (from) emit('reorder', path, from, to)
}
</script>

<template>
  <div :class="view === 'board' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-2'" :aria-label="view === 'board' ? 'Corkboard' : 'Outline'">
    <div v-for="(item, index) in items" :key="item.key" :data-item-key="item.key" draggable="true" class="cursor-grab" @dragstart="startItemDrag($event, path, item.key)" @dragover.prevent @drop.prevent="drop($event, path, item.key)">
      <CollectionCard :item="item" :compact="view === 'outline'" @open="emit('open', item)">
        <div class="flex items-center gap-1 mt-2">
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up" :disabled="index === 0" :aria-label="`Move ${item.title} earlier`" @click="emit('reorder', path, item.key, items[index - 1]!.key)" />
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-down" :disabled="index === items.length - 1" :aria-label="`Move ${item.title} later`" @click="emit('reorder', path, item.key, items[index + 1]!.key)" />
          <span v-if="item.document" class="text-xs text-muted ml-auto">{{ item.document.status }}</span>
        </div>
      </CollectionCard>
    </div>
    <p v-if="!items.length" class="text-muted py-8">This folder is empty. Add a document or subfolder.</p>
  </div>
</template>
