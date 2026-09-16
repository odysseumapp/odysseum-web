<script setup lang="ts">
import { folderIcon, kindIcons, linkedDocuments, type FolderItem } from '~/services/FolderStructure'
const props = defineProps<{ item: FolderItem; compact?: boolean }>()
const emit = defineEmits<{ open: [] }>()
const { project } = useWorkspace()
// Full cards carry their connections, so the Corkboard and Outline show who and what a document involves.
const links = computed(() => props.item.document && !props.compact && project.value ? linkedDocuments(project.value, props.item.document.id) : [])
const shown = 6
</script>

<template>
  <div class="relative min-w-0" :class="{ 'pb-2 pr-2': item.folder }" @dblclick="item.folder && emit('open')">
    <template v-if="item.folder"><div class="absolute inset-0 top-2 left-2 rounded-lg border border-default bg-muted" /><div class="absolute inset-1 rounded-lg border border-default bg-elevated" /></template>
    <div class="relative rounded-lg border border-default bg-default p-3" :class="{ 'min-h-28': !compact }">
      <button type="button" class="flex items-center gap-2 w-full text-left font-medium focus-visible:outline-2 focus-visible:outline-primary" :aria-label="`${item.folder ? 'Open folder' : 'Open'} ${item.title}`" @click="!item.folder && emit('open')" @keydown.enter.prevent="emit('open')" @keydown.space.prevent="emit('open')">
        <UIcon :name="item.folder ? folderIcon(item.folder.path) : kindIcons[item.document.kind]" class="size-4 shrink-0" /><span class="truncate">{{ item.title }}</span>
      </button>
      <p v-if="item.folder" class="text-xs text-muted mt-2">Folder · double-click to open</p>
      <template v-else-if="!compact">
        <p class="text-sm text-muted line-clamp-3 mt-2">{{ item.document.synopsis || 'No synopsis' }}</p>
        <p class="text-xs text-muted mt-2">{{ item.document.wordCount }} words</p>
        <div v-if="links.length" class="flex flex-wrap gap-1 mt-2" aria-label="Linked documents">
          <UBadge v-for="doc in links.slice(0, shown)" :key="doc.id" color="neutral" variant="subtle" size="sm" :icon="kindIcons[doc.kind]" class="max-w-full"><span class="truncate">{{ doc.title }}</span></UBadge>
          <UBadge v-if="links.length > shown" color="neutral" variant="subtle" size="sm">+{{ links.length - shown }}</UBadge>
        </div>
      </template>
      <slot />
    </div>
  </div>
</template>
