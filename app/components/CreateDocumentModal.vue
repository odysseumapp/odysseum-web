<script setup lang="ts">
import type { DocumentSummary } from '~/models'
import { folderChoices } from '~/services/FolderStructure'
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ kind: string; folderId: string }>()
const emit = defineEmits<{ created: [doc: DocumentSummary] }>()
const workspace = useWorkspace()
const title = ref('')
const folderId = ref('')
const folders = computed(() => workspace.project.value ? folderChoices(workspace.project.value) : [])
const { busy, error, run } = useTask()
watch(open, value => { if (value) { title.value = ''; folderId.value = props.folderId; error.value = '' } })
const create = () => run(async () => {
  const doc = await workspace.create(folderId.value, title.value)
  open.value = false
  emit('created', doc)
})
</script>

<template>
  <UModal v-model:open="open" :title="`New ${kind}`" description="Create a Markdown document in this project.">
    <template #body>
      <form class="space-y-4" @submit.prevent="create">
        <UFormField label="Title" required><UInput v-model="title" autofocus required maxlength="200" class="w-full" /></UFormField>
        <UFormField label="Folder"><USelect v-model="folderId" :items="folders" class="w-full" /></UFormField>
        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <UButton type="submit" :loading="busy">Create {{ kind }}</UButton>
      </form>
    </template>
  </UModal>
</template>
