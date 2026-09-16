<script setup lang="ts">
import type { DocumentSummary, MetadataFields } from '~/models'
import { documentChoices, kindIcons, kindLabels, kindOrder, linkedDocuments } from '~/services/FolderStructure'
defineProps<{ fields: MetadataFields; dirty: boolean; saving: boolean }>()
const emit = defineEmits<{ edit: []; reset: []; save: []; open: [doc: DocumentSummary]; history: []; move: [] }>()
const { project, active, selectedId } = useWorkspace()
const choices = computed(() => project.value ? documentChoices(project.value, selectedId.value).map(doc => ({ label: `${doc.title} · ${kindLabels[doc.kind]}`, value: doc.id, icon: kindIcons[doc.kind] })) : [])
// What is saved, grouped by kind; the select above holds the draft.
const linked = computed(() => {
  const docs = project.value ? linkedDocuments(project.value, selectedId.value) : []
  return kindOrder.map(kind => ({ kind, docs: docs.filter(doc => doc.kind === kind) })).filter(group => group.docs.length)
})
</script>

<template>
  <form v-if="active" class="space-y-4" aria-label="Document details" @submit.prevent="emit('save')">
    <h2 class="font-semibold">Document details</h2>
    <UFormField label="Title" required><UInput v-model="fields.title" class="w-full" required maxlength="200" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Draft status"><USelect v-model="fields.status" :items="[{ label: 'First draft', value: 'draft' }, { label: 'In revision', value: 'revised' }, { label: 'Finished', value: 'done' }]" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Synopsis"><UTextarea v-model="fields.synopsis" :rows="3" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Notes"><UTextarea v-model="fields.notes" :rows="3" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Links" help="Characters, locations, threads, notes — anything this document is connected to."><USelect v-model="fields.links" :items="choices" multiple class="w-full" placeholder="Link documents" @update:model-value="emit('edit')" /></UFormField>
    <UFormField v-if="active.document.kind === 'scene'" label="Scene word goal"><UInput v-model.number="fields.wordGoal" type="number" min="0" max="10000000" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <div class="space-y-2" aria-label="Linked documents">
      <h3 class="text-sm font-medium">Linked</h3>
      <template v-for="group in linked" :key="group.kind">
        <p class="text-xs text-muted uppercase tracking-wide">{{ kindLabels[group.kind] }}s</p>
        <UButton v-for="doc in group.docs" :key="doc.id" color="neutral" variant="link" :icon="kindIcons[doc.kind]" block class="justify-start" @click="emit('open', doc)">{{ doc.title }}</UButton>
      </template>
      <p v-if="!linked.length" class="text-sm text-muted">Nothing linked yet.</p>
    </div>
    <div v-if="dirty" class="flex gap-2"><UButton type="submit" :loading="saving">Save details</UButton><UButton color="neutral" variant="outline" @click="emit('reset')">Reset</UButton></div>
    <USeparator />
    <div class="flex flex-wrap gap-2"><UButton color="neutral" variant="outline" icon="i-lucide-history" @click="emit('history')">Version history</UButton><UButton color="neutral" variant="outline" @click="emit('move')">Move or rename file</UButton></div>
    <p class="text-xs text-muted break-all">{{ active.document.path }}</p>
  </form>
</template>
