<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const workspace = useWorkspace()
const settings = reactive({ title: '', wordGoal: 50000, defaultSceneWordGoal: 1000 })
const { busy, error, run } = useTask()
watch(open, value => { if (value && workspace.project.value) { Object.assign(settings, workspace.project.value.settings); error.value = '' } })
const save = () => run(async () => { await workspace.updateSettings(settings); open.value = false })
</script>

<template>
  <UModal v-model:open="open" title="Project settings" description="Set the title and word goals for this project.">
    <template #body>
      <form class="space-y-4" @submit.prevent="save">
        <UFormField label="Project title" required><UInput v-model="settings.title" required maxlength="200" class="w-full" /></UFormField>
        <UFormField label="Manuscript word goal"><UInput v-model.number="settings.wordGoal" type="number" min="0" max="10000000" required class="w-full" /></UFormField>
        <UFormField label="Default scene word goal"><UInput v-model.number="settings.defaultSceneWordGoal" type="number" min="0" max="10000000" required class="w-full" /></UFormField>
        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <UButton type="submit" :loading="busy">Save settings</UButton>
      </form>
    </template>
  </UModal>
</template>
