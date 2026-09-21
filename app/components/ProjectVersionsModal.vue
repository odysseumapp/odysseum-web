<script setup lang="ts">
import type { ProjectVersion } from '~/models'
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ restored: [] }>()
const workspace = useWorkspace()
const { sync } = workspace
const { busy, error, run } = useTask()
const versions = ref<ProjectVersion[]>([])
const saveAs = ref('')
const confirming = ref('')
const notice = ref('')
watch(open, value => {
  if (!value) return
  error.value = ''
  confirming.value = ''
  notice.value = ''
  saveAs.value = ''
  void run(async () => { versions.value = await workspace.versions() })
})
const clean = computed(() => saveAs.value.trim())
const canSave = computed(() => clean.value.length > 0 && clean.value.length <= 200 && sync.value.online)
const when = (version: ProjectVersion) => new Date(version.saved).toLocaleString()
const label = (version: ProjectVersion) => version.name ?? 'Automatic'
const files = (version: ProjectVersion) => `${version.changes} ${version.changes === 1 ? 'file' : 'files'}`
const save = () => run(async () => {
  notice.value = ''
  const saved = await workspace.saveVersion(clean.value)
  versions.value = await workspace.versions()
  saveAs.value = ''
  notice.value = `Saved “${saved.name}”.`
})
const restore = (version: ProjectVersion) => run(async () => {
  notice.value = ''
  await workspace.restoreVersion(version.id)
  confirming.value = ''
  versions.value = await workspace.versions()
  notice.value = `Restored “${label(version)}” from ${when(version)}. What you had before is the newest version.`
  emit('restored')
})
</script>

<template>
  <UModal v-model:open="open" title="Project versions" description="Every file in the project as it was at each save. Restoring writes those files back; what you have now is kept as a version too." :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <div class="space-y-6">
        <p v-if="!sync.online" class="text-sm text-muted">Offline: versions live on the server and can be saved or restored once you are connected.</p>
        <section class="space-y-2" aria-label="Saved versions">
          <ul class="space-y-1 max-h-80 overflow-auto">
            <li v-for="version in versions" :key="version.id" class="flex items-center gap-2">
              <div class="flex-1 min-w-0">
                <p class="truncate" :class="{ 'text-muted': version.automatic }">{{ label(version) }}</p>
                <p class="text-xs text-muted">{{ when(version) }} · {{ files(version) }}</p>
              </div>
              <UButton v-if="confirming === version.id" color="warning" variant="soft" :loading="busy" @click="restore(version)">Restore this version</UButton>
              <UButton color="neutral" variant="ghost" :icon="confirming === version.id ? 'i-lucide-x' : 'i-lucide-archive-restore'" :aria-label="confirming === version.id ? 'Keep what you have' : `Restore ${label(version)}`" :disabled="!sync.online" @click="confirming = confirming === version.id ? '' : version.id" />
            </li>
          </ul>
          <p v-if="!versions.length" class="text-sm text-muted">{{ busy ? 'Loading versions…' : 'No versions yet. One is saved after the project has been quiet for a while, or save one now.' }}</p>
        </section>

        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <UAlert v-else-if="notice" color="success" :description="notice" role="status" />

        <form class="flex flex-wrap items-end gap-2" @submit.prevent="save">
          <UFormField label="Save this version as" class="flex-1 min-w-48"><UInput v-model="saveAs" maxlength="200" placeholder="Before the rewrite" class="w-full" /></UFormField>
          <UButton type="submit" icon="i-lucide-save" :disabled="!canSave" :loading="busy">Save version</UButton>
          <p class="basis-full text-xs text-muted">Unsaved edits are sent to the server first, so the version is what you see now.</p>
        </form>
      </div>
    </template>
  </UModal>
</template>
