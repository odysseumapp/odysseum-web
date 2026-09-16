<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const workspace = useWorkspace()
const allowDeletingDefaultFolders = ref(false)
const { busy, error, run } = useTask()
watch(open, value => { if (value) { allowDeletingDefaultFolders.value = workspace.allowDeletingDefaultFolders.value; error.value = '' } })
const save = () => run(async () => { await workspace.updateServerSettings({ allowDeletingDefaultFolders: allowDeletingDefaultFolders.value }); open.value = false })
</script>

<template>
  <UModal v-model:open="open" title="Server settings">
    <template #body>
      <form class="space-y-4" @submit.prevent="save">
        <USwitch v-model="allowDeletingDefaultFolders" label="Allow deleting default project folders?" />
        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <UButton type="submit" :loading="busy">Save settings</UButton>
      </form>
    </template>
  </UModal>
</template>
