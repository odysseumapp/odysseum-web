<script setup lang="ts">
import { statusLabel, type DocumentSummary } from '~/models'
defineProps<{ documents: DocumentSummary[]; view: 'board' | 'outline' }>()
const emit = defineEmits<{ select: [doc: DocumentSummary] }>()
const columns = [{ accessorKey: 'title', header: 'Document' }, { accessorKey: 'folder', header: 'Folder' }, { accessorKey: 'synopsis', header: 'Synopsis' }, { accessorKey: 'status', header: 'Status' }, { accessorKey: 'wordCount', header: 'Words' }]
</script>

<template>
  <div>
    <h2 class="text-xl font-semibold mb-4">{{ view === 'board' ? 'Corkboard' : 'Outline' }}</h2>
    <div v-if="view === 'board'" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <UCard v-for="doc in documents" :key="doc.id">
        <template #header><UButton color="neutral" variant="link" class="p-0 text-left whitespace-normal" @click="emit('select', doc)">{{ doc.title }}</UButton></template>
        <p class="text-sm whitespace-pre-wrap">{{ doc.synopsis || 'No synopsis.' }}</p>
        <template #footer><div class="flex items-center justify-between gap-2"><UBadge color="neutral" variant="subtle">{{ statusLabel(doc.status) }}</UBadge><span class="text-xs text-muted">{{ doc.wordCount }} words</span></div></template>
      </UCard>
    </div>
    <UTable v-else :data="documents" :columns="columns">
      <template #title-cell="{ row }"><UButton color="neutral" variant="link" class="p-0" @click="emit('select', row.original)">{{ row.original.title }}</UButton></template>
      <template #status-cell="{ row }"><UBadge color="neutral" variant="subtle">{{ statusLabel(row.original.status) }}</UBadge></template>
    </UTable>
    <p v-if="!documents.length" class="text-muted py-8">No documents in this section.</p>
  </div>
</template>
