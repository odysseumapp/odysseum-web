<script setup lang="ts">
import type { DocumentSummary } from '~/models'
const props = defineProps<{ documents: DocumentSummary[]; selectedId: string; section: string }>()
const emit = defineEmits<{ select: [doc: DocumentSummary]; reorder: [from: string, to: string] }>()
const dragged = ref('')
const groups = computed(() => {
  const folders = new Map<string, DocumentSummary[]>()
  for (const doc of props.documents) {
    const folder = doc.folder || 'Project root'
    if (!folders.has(folder)) folders.set(folder, [])
    folders.get(folder)!.push(doc)
  }
  return [...folders].map(([folder, documents]) => ({ folder, documents }))
})
function move(doc: DocumentSummary, direction: number) {
  const neighbor = props.documents[props.documents.findIndex(item => item.id === doc.id) + direction]
  if (neighbor) emit('reorder', doc.id, neighbor.id)
}
</script>

<template>
  <nav :aria-label="`${section} documents`" class="space-y-3">
    <UCollapsible v-for="group in groups" :key="group.folder" default-open>
      <UButton color="neutral" variant="ghost" icon="i-lucide-folder" trailing-icon="i-lucide-chevron-down" block class="justify-start text-left mb-1"><span class="truncate">{{ group.folder }}</span></UButton>
      <template #content>
        <div v-for="(doc, index) in group.documents" :key="doc.id" class="group flex items-center gap-1" draggable="true" @dragstart="dragged = doc.id; $event.dataTransfer?.setData('text/plain', doc.id)" @dragover.prevent @drop.prevent="emit('reorder', dragged, doc.id); dragged = ''" @dragend="dragged = ''">
          <UButton :variant="selectedId === doc.id ? 'soft' : 'ghost'" :color="selectedId === doc.id ? 'primary' : 'neutral'" class="flex-1 min-w-0 justify-start" :aria-current="selectedId === doc.id ? 'true' : undefined" @click="emit('select', doc)"><span class="truncate">{{ doc.title }}</span></UButton>
          <div class="flex shrink-0">
            <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up" :aria-label="`Move ${doc.title} up`" :disabled="documents[0]?.id === doc.id" @click="move(doc, -1)" />
            <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down" :aria-label="`Move ${doc.title} down`" :disabled="documents.at(-1)?.id === doc.id" @click="move(doc, 1)" />
          </div>
        </div>
      </template>
    </UCollapsible>
    <p v-if="!documents.length" class="text-sm text-muted p-2">No documents in this section.</p>
  </nav>
</template>
