<script setup lang="ts">
import type { DocumentDetails, DocumentSummary } from '~/models'
import { documentChoices, kindIcons, kindLabels, kindOrder, linkBetween, linkedDocuments } from '~/services/FolderStructure'
defineProps<{ fields: DocumentDetails; dirty: boolean; saving: boolean }>()
const emit = defineEmits<{ edit: []; reset: []; save: []; open: [doc: DocumentSummary]; history: []; move: [] }>()
const workspace = useWorkspace()
const { project, active, selectedId } = workspace
const choices = computed(() => project.value ? documentChoices(project.value, selectedId.value).map(doc => ({ label: `${doc.title} · ${kindLabels[doc.kind]}`, value: doc.id, icon: kindIcons[doc.kind] })) : [])
const linkedDocs = computed(() => project.value ? linkedDocuments(project.value, selectedId.value) : [])
const linkedIds = computed(() => linkedDocs.value.map(doc => doc.id))
const linked = computed(() => kindOrder.map(kind => ({ kind, docs: linkedDocs.value.filter(doc => doc.kind === kind) })).filter(group => group.docs.length))
const { error, run } = useTask()

/** Links are their own items on the server, so a change applies at once instead of with the other details. */
function setLinks(next: unknown) {
  if (!Array.isArray(next) || !project.value) return
  const id = selectedId.value
  const wanted = new Set(next.filter((value): value is string => typeof value === 'string'))
  const current = new Set(linkedIds.value)
  void run(async () => {
    for (const other of wanted) if (!current.has(other)) await workspace.link(id, other)
    for (const other of current) {
      const link = !wanted.has(other) && project.value ? linkBetween(project.value, id, other) : undefined
      if (link) await workspace.unlink(link.id)
    }
  })
}
</script>

<template>
  <form v-if="active" class="space-y-4" aria-label="Document details" @submit.prevent="emit('save')">
    <h2 class="font-semibold">Document details</h2>
    <UFormField label="Title" required><UInput v-model="fields.title" class="w-full" required maxlength="200" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Draft status"><USelect v-model="fields.status" :items="[{ label: 'First draft', value: 'draft' }, { label: 'In revision', value: 'revised' }, { label: 'Finished', value: 'done' }]" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Synopsis"><UTextarea v-model="fields.synopsis" :rows="3" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Notes"><UTextarea v-model="fields.notes" :rows="3" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Links" help="Characters, locations, threads, notes — anything this document is connected to. Changes apply at once."><USelect :model-value="linkedIds" :items="choices" multiple class="w-full" placeholder="Link documents" @update:model-value="setLinks" /></UFormField>
    <UAlert v-if="error" color="error" :description="error" role="alert" />
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
    <div class="flex flex-wrap gap-2"><UButton color="neutral" variant="outline" icon="i-lucide-history" @click="emit('history')">Version history</UButton><UButton v-if="!active.document.isFolderDocument" color="neutral" variant="outline" @click="emit('move')">Rename or move</UButton></div>
    <p class="text-xs text-muted break-all">{{ active.document.name }}</p>
  </form>
</template>
