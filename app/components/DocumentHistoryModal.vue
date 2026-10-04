<script setup lang="ts">
import type { Version } from '~/models'
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ restored: [] }>()
const workspace = useWorkspace()
const { active, selectedId } = workspace
const versions = ref<Version[]>([])
const preview = ref<string | null>(null)
const target = ref('')
const fresh = ref(true)
const { busy, error, run } = useTask()
watch(open, value => {
  if (!value) return
  target.value = selectedId.value
  preview.value = null
  versions.value = []
  void run(async () => {
    const result = await workspace.documentVersions(target.value)
    versions.value = result.versions
    fresh.value = result.fresh
  })
})
const label = (version: Version) => `${new Date(version.saved).toLocaleString()}${version.name ? ` · ${version.name}` : ''}`
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
  <UModal v-model:open="open" title="Version history" description="Preview a saved version and restore it to the editor." :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <p v-if="!fresh" class="text-sm text-muted mb-4">Offline: showing versions already fetched on this device.</p>
      <div class="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <div class="space-y-2 max-h-80 overflow-auto">
          <UButton v-for="version in versions" :key="version.id" block color="neutral" variant="outline" :disabled="busy" @click="run(async () => { preview = await workspace.documentVersionText(target, version.id) })">{{ label(version) }}</UButton>
          <p v-if="!versions.length" class="text-sm text-muted">{{ busy ? 'Loading versions…' : 'No saved versions yet.' }}</p>
        </div>
        <pre class="bg-muted rounded-md p-4 whitespace-pre-wrap max-h-80 overflow-auto text-sm" aria-label="Version preview">{{ preview ?? 'Select a version.' }}</pre>
      </div>
      <UAlert v-if="error" color="error" :description="error" role="alert" class="mt-4" />
    </template>
    <template #footer><div class="space-y-2"><UButton :disabled="!canRestore || busy" @click="restore">Restore to editor</UButton><p v-if="active && workspace.dirty(active)" class="text-sm text-muted">Save the current draft before restoring a version.</p></div></template>
  </UModal>
</template>
