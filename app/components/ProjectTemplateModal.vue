<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const workspace = useWorkspace()
const { templates, project } = workspace
const { busy, error, run } = useTask()
const saveAs = ref('')
const confirming = ref('')
const saved = ref('')
watch(open, value => {
  if (!value) return
  error.value = ''
  confirming.value = ''
  saved.value = ''
  saveAs.value = project.value?.settings.title.slice(0, 60) ?? ''
  void run(workspace.loadTemplates)
})
const clean = computed(() => saveAs.value.trim())
const canSave = computed(() => clean.value.length > 0 && clean.value.length <= 60)
const replaces = computed(() => templates.value.some(item => item.name.toLocaleLowerCase() === clean.value.toLocaleLowerCase()))
const save = () => run(async () => { saved.value = ''; saved.value = (await workspace.saveTemplate(clean.value)).name })
const remove = (name: string) => run(async () => { await workspace.deleteTemplate(name); confirming.value = '' })
const summary = (folders: number, documents: number) => `${folders} ${folders === 1 ? 'folder' : 'folders'}, ${documents} ${documents === 1 ? 'document' : 'documents'}`
</script>

<template>
  <UModal v-model:open="open" title="Project templates" description="Save this project's folders, goals and document names as a starting point for new projects.">
    <template #body>
      <div class="space-y-6">
        <section class="space-y-2" aria-label="Saved templates">
          <h3 class="font-semibold">Saved templates</h3>
          <ul class="space-y-1">
            <li v-for="item in templates" :key="item.name" class="flex items-center gap-2">
              <UButton color="neutral" variant="ghost" class="flex-1 min-w-0 justify-start gap-2" :aria-label="`Save over ${item.name}`" @click="saveAs = item.name">
                <span class="truncate">{{ item.name }}</span>
                <span class="text-xs text-muted shrink-0">{{ summary(item.folders.filter(folder => folder.path).length, item.documents.length) }}</span>
              </UButton>
              <UButton v-if="confirming === item.name" color="error" variant="soft" :loading="busy" @click="remove(item.name)">{{ item.name === 'Default' ? 'Reset' : 'Delete' }}</UButton>
              <UButton color="neutral" variant="ghost" :icon="confirming === item.name ? 'i-lucide-x' : item.name === 'Default' ? 'i-lucide-rotate-ccw' : 'i-lucide-trash-2'" :aria-label="confirming === item.name ? `Keep ${item.name}` : item.name === 'Default' ? 'Reset Default to the one Odysseum ships with' : `Delete ${item.name}`" @click="confirming = confirming === item.name ? '' : item.name" />
            </li>
          </ul>
        </section>

        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <UAlert v-else-if="saved" color="success" :description="`Saved as “${saved}”. New projects can start from it.`" />

        <form class="flex flex-wrap items-end gap-2" @submit.prevent="save">
          <UFormField label="Save this project as" class="flex-1 min-w-48"><UInput v-model="saveAs" maxlength="60" placeholder="Three-act novel" class="w-full" /></UFormField>
          <UButton type="submit" icon="i-lucide-save" :disabled="!canSave" :loading="busy">{{ replaces ? 'Replace' : 'Save' }}</UButton>
          <p class="basis-full text-xs text-muted">{{ replaces ? 'Replaces the template of that name.' : 'Documents are kept by name only; new projects get them empty.' }}</p>
        </form>
      </div>
    </template>
  </UModal>
</template>
