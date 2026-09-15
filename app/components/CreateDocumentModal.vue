<script setup lang="ts">
import type { DocumentSummary } from '~/models'
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ kind: string; folder: string }>()
const emit = defineEmits<{ created: [doc: DocumentSummary] }>()
const workspace = useWorkspace()
const title = ref('')
const folder = ref('')
const { busy, error, run } = useTask()
watch(open, value => { if (value) { title.value = ''; folder.value = props.folder; error.value = '' } })
const create = () => run(async () => {
  const doc = await workspace.create(title.value, folder.value)
  open.value = false
  emit('created', doc)
})
</script>

<template>
  <UModal v-model:open="open" :title="`New ${kind}`" description="Create a Markdown document in this project.">
    <template #body>
      <form class="space-y-4" @submit.prevent="create">
        <UFormField label="Title" required><UInput v-model="title" autofocus required maxlength="200" class="w-full" /></UFormField>
        <UFormField label="Folder" description="Use / for nested folders. The top-level folder determines the document type."><UInput v-model="folder" class="w-full" /></UFormField>
        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <UButton type="submit" :loading="busy">Create {{ kind }}</UButton>
      </form>
    </template>
  </UModal>
</template>
