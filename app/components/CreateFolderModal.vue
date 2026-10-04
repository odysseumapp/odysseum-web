<script setup lang="ts">
import { folderPath } from '~/services/FolderStructure'
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ parentId: string }>()
const emit = defineEmits<{ created: [folderId: string] }>()
const workspace = useWorkspace()
const name = ref('')
const parentLabel = computed(() => workspace.project.value && props.parentId ? folderPath(workspace.project.value, props.parentId) || 'the project root' : 'the project root')
const { busy, error, run } = useTask()
watch(open, value => { if (value) { name.value = ''; error.value = '' } })
function create() {
  return run(async () => {
    const clean = name.value.trim()
    if (clean.includes('/')) throw new Error('Enter a single folder name.')
    const id = await workspace.createFolder(props.parentId, clean)
    open.value = false
    emit('created', id)
  })
}
</script>

<template>
  <UModal v-model:open="open" title="New folder" :description="`Create a folder in ${parentLabel}.`">
    <template #body><form class="space-y-4" @submit.prevent="create"><UFormField label="Folder name" required><UInput v-model="name" autofocus required maxlength="200" class="w-full" /></UFormField><UAlert v-if="error" color="error" :description="error" role="alert" /><UButton type="submit" :loading="busy">Create folder</UButton></form></template>
  </UModal>
</template>
