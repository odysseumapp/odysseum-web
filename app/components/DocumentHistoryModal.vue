<script setup lang="ts">
import type { Snapshot } from '~/models'
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ restored: [] }>()
const workspace = useWorkspace()
const { active, selectedId } = workspace
const snapshots = ref<Snapshot[]>([])
const preview = ref<string | null>(null)
const target = ref('')
const fresh = ref(true)
const { busy, error, run } = useTask()
watch(open, value => {
  if (!value) return
  target.value = selectedId.value
  preview.value = null
  snapshots.value = []
  void run(async () => {
    const result = await workspace.snapshots(target.value)
    snapshots.value = result.snapshots
    fresh.value = result.fresh
  })
})
const canRestore = computed(() => preview.value !== null && target.value === selectedId.value && active.value &&
  !active.value.conflict && !active.value.saving && !workspace.dirty(active.value))
function restore() {
  if (!canRestore.value || preview.value === null) return
  workspace.edit(preview.value)
  open.value = false
  emit('restored')
}
</script>

<template>
  <UModal v-model:open="open" title="Version history" description="Preview a saved revision and restore it to the editor." :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <p v-if="!fresh" class="text-sm text-muted mb-4">Offline: showing revisions already fetched on this device.</p>
      <div class="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <div class="space-y-2 max-h-80 overflow-auto">
          <UButton v-for="snapshot in snapshots" :key="snapshot.id" block color="neutral" variant="outline" :disabled="busy" @click="run(async () => { preview = await workspace.snapshot(target, snapshot.id) })">{{ new Date(snapshot.created).toLocaleString() }} · {{ snapshot.wordCount }} words</UButton>
          <p v-if="!snapshots.length" class="text-sm text-muted">{{ busy ? 'Loading revisions…' : 'No saved revisions yet.' }}</p>
        </div>
        <pre class="bg-muted rounded-md p-4 whitespace-pre-wrap max-h-80 overflow-auto text-sm" aria-label="Revision preview">{{ preview ?? 'Select a revision.' }}</pre>
      </div>
      <UAlert v-if="error" color="error" :description="error" role="alert" class="mt-4" />
    </template>
    <template #footer><div class="space-y-2"><UButton :disabled="!canRestore || busy" @click="restore">Restore to editor</UButton><p v-if="active && workspace.dirty(active)" class="text-sm text-muted">Save the current draft before restoring a revision.</p></div></template>
  </UModal>
</template>
