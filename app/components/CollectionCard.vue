<script setup lang="ts">
import type { FolderItem } from '~/services/FolderStructure'
defineProps<{ item: FolderItem; compact?: boolean }>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <div class="relative min-w-0" :class="{ 'pb-2 pr-2': item.folder }" @dblclick="item.folder && emit('open')">
    <template v-if="item.folder"><div class="absolute inset-0 top-2 left-2 rounded-lg border border-default bg-muted" /><div class="absolute inset-1 rounded-lg border border-default bg-elevated" /></template>
    <div class="relative rounded-lg border border-default bg-default p-3" :class="{ 'min-h-28': !compact }">
      <button type="button" class="flex items-center gap-2 w-full text-left font-medium focus-visible:outline-2 focus-visible:outline-primary" :aria-label="`${item.folder ? 'Open folder' : 'Open'} ${item.title}`" @click="!item.folder && emit('open')" @keydown.enter.prevent="emit('open')" @keydown.space.prevent="emit('open')">
        <UIcon :name="item.folder ? 'i-lucide-layers' : 'i-lucide-file-text'" class="size-4 shrink-0" /><span class="truncate">{{ item.title }}</span>
      </button>
      <p v-if="item.folder" class="text-xs text-muted mt-2">Folder · double-click to open</p>
      <template v-else-if="!compact"><p class="text-sm text-muted line-clamp-3 mt-2">{{ item.document.synopsis || 'No synopsis' }}</p><p class="text-xs text-muted mt-2">{{ item.document.wordCount }} words</p></template>
      <slot />
    </div>
  </div>
</template>
