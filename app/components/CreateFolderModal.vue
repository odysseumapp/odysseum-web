<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ parent: string }>()
const emit = defineEmits<{ created: [path: string] }>()
const workspace = useWorkspace()
const name = ref('')
const { busy, error, run } = useTask()
watch(open, value => { if (value) { name.value = ''; error.value = '' } })
function create() {
  return run(async () => {
    const clean = name.value.trim()
    if (clean.includes('/')) throw new Error('Enter a single folder name.')
    const path = [props.parent, clean].filter(Boolean).join('/')
    await workspace.createFolder(path)
    open.value = false
    emit('created', path)
  })
}
</script>

<template>
  <UModal v-model:open="open" title="New folder" :description="`Create a folder in ${parent || 'the project root'}.`">
    <template #body><form class="space-y-4" @submit.prevent="create"><UFormField label="Folder name" required><UInput v-model="name" autofocus required maxlength="200" class="w-full" /></UFormField><UAlert v-if="error" color="error" :description="error" role="alert" /><UButton type="submit" :loading="busy">Create folder</UButton></form></template>
  </UModal>
</template>
