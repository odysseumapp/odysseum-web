<script setup lang="ts">
import type { DocumentSummary } from '~/models'
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [doc: DocumentSummary] }>()
const workspace = useWorkspace()
const query = ref('')
const results = computed(() => query.value.trim() ? workspace.search(query.value) : [])
</script>

<template>
  <UModal v-model:open="open" title="Search documents" description="Search titles, details and document content, including local edits.">
    <template #body>
      <UInput v-model="query" autofocus icon="i-lucide-search" aria-label="Search documents" class="w-full mb-4" />
      <div class="space-y-2">
        <UButton v-for="result in results" :key="result.document.id" color="neutral" variant="ghost" block class="justify-start text-left" @click="emit('select', result.document); open = false">
          <span class="min-w-0"><span class="block font-medium">{{ result.document.title }}</span><span class="block text-muted text-sm truncate">{{ result.excerpt }}</span></span>
        </UButton>
        <p v-if="!results.length" class="text-sm text-muted">{{ query ? 'No matches.' : 'Enter a search term.' }}</p>
      </div>
    </template>
  </UModal>
</template>
