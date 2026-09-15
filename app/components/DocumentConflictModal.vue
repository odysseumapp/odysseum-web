<script setup lang="ts">
import { downloadText } from '~/services/ManuscriptExport'
const open = defineModel<boolean>('open', { required: true })
const workspace = useWorkspace()
const { active } = workspace
const { busy, error, run } = useTask()
const resolve = (action: () => Promise<unknown>) => run(async () => { await action(); open.value = false })
</script>

<template>
  <UModal v-model:open="open" title="Review changes" description="The browser draft and the file have changed independently." :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div v-if="active" class="grid sm:grid-cols-2 gap-4">
        <UFormField label="Your browser draft"><UTextarea :model-value="active.content" :rows="12" class="w-full" @update:model-value="workspace.edit" /></UFormField>
        <div><h3 class="text-sm font-medium mb-2">Current file on disk</h3><pre class="bg-muted p-3 rounded-md whitespace-pre-wrap text-sm max-h-80 overflow-auto">{{ active.conflict && active.conflict !== 'deleted' ? active.conflict.content : 'The file has been removed.' }}</pre></div>
      </div>
      <UAlert v-if="error" color="error" :description="error" role="alert" class="mt-4" />
    </template>
    <template #footer><div v-if="active" class="flex flex-wrap gap-2">
      <UButton color="neutral" variant="outline" @click="downloadText(`${active.document.title}-draft.md`, active.content)">Download draft</UButton>
      <UButton color="neutral" variant="outline" :disabled="busy" @click="resolve(workspace.saveCopy)">Save as new document</UButton>
      <UButton v-if="active.conflict === 'deleted'" color="neutral" variant="outline" :disabled="busy" @click="resolve(workspace.discard)">Discard draft</UButton>
      <template v-else><UButton color="neutral" variant="outline" :disabled="busy" @click="resolve(workspace.useDisk)">Use disk version</UButton><UButton :loading="busy" @click="resolve(workspace.keepMine)">Save my version</UButton></template>
    </div></template>
  </UModal>
</template>
