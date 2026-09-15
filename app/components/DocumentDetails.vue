<script setup lang="ts">
import type { DocumentSummary, MetadataFields } from '~/models'
const props = defineProps<{ fields: MetadataFields; dirty: boolean; saving: boolean }>()
const emit = defineEmits<{ edit: []; reset: []; save: []; open: [doc: DocumentSummary]; history: []; move: [] }>()
const { project, active, selectedId } = useWorkspace()
const choices = (kind: string) => project.value?.documents.filter(doc => doc.kind === kind).map(doc => ({ label: doc.title, value: doc.id })) ?? []
const characters = computed(() => choices('character'))
const locations = computed(() => choices('location'))
const arcs = computed(() => choices('arc'))
const arcIds = computed({
  get: () => Object.keys(props.fields.arcPositions),
  set(ids: string[]) {
    props.fields.arcPositions = Object.fromEntries(ids.map(id => [id, props.fields.arcPositions[id] ?? Math.min(10000,
      Math.floor(Math.max(-1, ...(project.value?.documents ?? []).filter(doc => doc.kind === 'beat').map(doc => doc.arcPositions?.[id] ?? -1))) + 1)]))
    emit('edit')
  },
})
const appearances = computed(() => project.value?.documents.filter(doc => doc.kind === 'scene' &&
  (active.value?.document.kind === 'location' ? doc.locations : doc.characters).includes(selectedId.value)) ?? [])
</script>

<template>
  <form v-if="active" class="space-y-4" aria-label="Document details" @submit.prevent="emit('save')">
    <h2 class="font-semibold">Document details</h2>
    <UFormField label="Title" required><UInput v-model="fields.title" class="w-full" required maxlength="200" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Draft status"><USelect v-model="fields.status" :items="[{ label: 'First draft', value: 'draft' }, { label: 'In revision', value: 'revised' }, { label: 'Finished', value: 'done' }]" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Synopsis"><UTextarea v-model="fields.synopsis" :rows="3" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <UFormField label="Notes"><UTextarea v-model="fields.notes" :rows="3" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    <template v-if="active.document.kind === 'scene'">
      <UFormField label="Characters"><USelect v-model="fields.characters" :items="characters" multiple class="w-full" placeholder="Select characters" @update:model-value="emit('edit')" /></UFormField>
      <UFormField label="Locations"><USelect v-model="fields.locations" :items="locations" multiple class="w-full" placeholder="Select locations" @update:model-value="emit('edit')" /></UFormField>
      <UFormField label="Scene word goal"><UInput v-model.number="fields.wordGoal" type="number" min="0" max="10000000" class="w-full" @update:model-value="emit('edit')" /></UFormField>
    </template>
    <UFormField v-if="active.document.kind === 'beat'" label="Story arcs"><USelect v-model="arcIds" :items="arcs" multiple class="w-full" placeholder="Select arcs" /></UFormField>
    <div v-if="active.document.kind === 'character' || active.document.kind === 'location'" class="space-y-2">
      <h3 class="text-sm font-medium">Appears in</h3>
      <UButton v-for="doc in appearances" :key="doc.id" color="neutral" variant="link" block class="justify-start" @click="emit('open', doc)">{{ doc.title }}</UButton>
      <p v-if="!appearances.length" class="text-sm text-muted">No linked scenes.</p>
    </div>
    <div v-if="dirty" class="flex gap-2"><UButton type="submit" :loading="saving">Save details</UButton><UButton color="neutral" variant="outline" @click="emit('reset')">Reset</UButton></div>
    <USeparator />
    <div class="flex flex-wrap gap-2"><UButton color="neutral" variant="outline" icon="i-lucide-history" @click="emit('history')">Version history</UButton><UButton color="neutral" variant="outline" @click="emit('move')">Move or rename file</UButton></div>
    <p class="text-xs text-muted break-all">{{ active.document.path }}</p>
  </form>
</template>
