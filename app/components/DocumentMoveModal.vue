<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const workspace = useWorkspace()
const path = ref('')
const { busy, error, run } = useTask()
watch(open, value => { if (value) { path.value = workspace.active.value?.document.path ?? ''; error.value = '' } })
const move = () => run(async () => { await workspace.move(path.value); open.value = false })
</script>

<template>
  <UModal v-model:open="open" title="Move or rename file" description="The document keeps its ID, details and history. Changing the top-level folder can change its type.">
    <template #body><form class="space-y-4" @submit.prevent="move">
      <UFormField label="Path within project" required><UInput v-model="path" required class="w-full" /></UFormField>
      <UAlert v-if="error" color="error" :description="error" role="alert" />
      <UButton type="submit" :loading="busy">Move file</UButton>
    </form></template>
  </UModal>
</template>
