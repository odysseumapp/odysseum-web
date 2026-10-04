<script setup lang="ts">
import { folderChoices, findFolder } from '~/services/FolderStructure'
const open = defineModel<boolean>('open', { required: true })
const workspace = useWorkspace()
const name = ref('')
const folderId = ref('')
const folders = computed(() => workspace.project.value ? folderChoices(workspace.project.value) : [])
const { busy, error, run } = useTask()
watch(open, value => {
  const doc = workspace.active.value?.document
  if (!value || !doc) return
  name.value = doc.name.replace(/\.md$/i, '')
  folderId.value = doc.folderId
  error.value = ''
})
const save = () => run(async () => {
  const doc = workspace.active.value?.document
  const project = workspace.project.value
  if (!doc || !project) return
  if (name.value.trim() !== doc.name.replace(/\.md$/i, '')) await workspace.rename(doc.id, name.value)
  if (folderId.value !== doc.folderId) await workspace.move(doc.id, folderId.value, findFolder(project, folderId.value)?.childIds.length ?? 0)
  open.value = false
})
</script>

<template>
  <UModal v-model:open="open" title="Rename or move" description="The document keeps its ID, details, links and history. Moving it to another top-level folder can change its type.">
    <template #body><form class="space-y-4" @submit.prevent="save">
      <UFormField label="File name" required><UInput v-model="name" required maxlength="200" class="w-full" /></UFormField>
      <UFormField label="Folder"><USelect v-model="folderId" :items="folders" class="w-full" /></UFormField>
      <UAlert v-if="error" color="error" :description="error" role="alert" />
      <UButton type="submit" :loading="busy">Save</UButton>
    </form></template>
  </UModal>
</template>
