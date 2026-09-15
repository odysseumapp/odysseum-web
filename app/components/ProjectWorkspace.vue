<script setup lang="ts">
import { countWords, type DocumentSummary } from '~/models'
import { metadataOf } from '~/composables/useDocumentDetails'

const workspace = useWorkspace()
const { project, active, selectedId, sync, notice, passwordRequired } = workspace
const { details, saving, edit: editDetails, reset, save: saveDetails, place } = useDocumentDetails()
const { busy, error, run } = useTask()
const sections = [
  { label: 'Manuscript', value: 'scene', folder: 'Manuscript' },
  { label: 'Notes', value: 'note', folder: 'Notes' },
  { label: 'Characters', value: 'character', folder: 'Characters' },
  { label: 'Locations', value: 'location', folder: 'Locations' },
  { label: 'Arcs', value: 'arc', folder: 'Arcs' },
]
const section = ref('scene')
const currentSection = computed(() => sections.find(item => item.value === section.value)!)
const view = ref('write')
const focus = ref(false)
const source = ref(false)
const reading = ref(false)
const fontSize = ref(16)
const mobileSidebar = ref(false)
const inspector = ref(false)
const createOpen = ref(false)
const searchOpen = ref(false)
const settingsOpen = ref(false)
const historyOpen = ref(false)
const moveOpen = ref(false)
const conflictOpen = ref(false)
const editor = ref<{ format: (type: string) => void }>()
const rendered = ref('')
const documents = computed(() => project.value?.documents.filter(doc => section.value === 'arc' ? doc.kind === 'arc' || doc.kind === 'beat' : doc.kind === section.value) ?? [])
const arcs = computed(() => project.value?.documents.filter(doc => doc.kind === 'arc') ?? [])
const beats = computed(() => project.value?.documents.filter(doc => doc.kind === 'beat') ?? [])
const words = computed(() => countWords(active.value?.content ?? ''))
const totalWords = computed(() => project.value?.documents.filter(doc => doc.kind === 'scene').reduce((sum, doc) => sum + (doc.id === selectedId.value ? words.value : doc.wordCount), 0) ?? 0)
const savedState = computed(() => {
  if (active.value?.conflict) return 'Review changes'
  if (active.value?.error || sync.value.error) return 'Save interrupted'
  if (!active.value || !workspace.dirty(active.value)) return sync.value.pending ? 'Changes pending' : 'All changes saved'
  return sync.value.online ? 'Saving…' : 'Saved on this device'
})
const tabs = computed(() => [
  { label: 'Write', value: 'write', icon: 'i-lucide-file-text' },
  { label: 'Corkboard', value: 'board', icon: 'i-lucide-layout-grid' },
  { label: 'Outline', value: 'outline', icon: 'i-lucide-list' },
  ...(section.value === 'arc' ? [{ label: 'Arcs', value: 'arcs', icon: 'i-lucide-git-branch' }] : []),
])
const formatting = [
  { type: 'undo', label: 'Undo', icon: 'i-lucide-undo-2' }, { type: 'redo', label: 'Redo', icon: 'i-lucide-redo-2' },
  { type: 'bold', label: 'Bold', icon: 'i-lucide-bold' }, { type: 'italic', label: 'Italic', icon: 'i-lucide-italic' },
  { type: 'heading', label: 'Heading', icon: 'i-lucide-heading-2' }, { type: 'quote', label: 'Blockquote', icon: 'i-lucide-quote' },
  { type: 'list', label: 'Bulleted list', icon: 'i-lucide-list' }, { type: 'break', label: 'Scene break', icon: 'i-lucide-minus' },
]
let renderGeneration = 0
watch([reading, () => active.value?.content], async ([show, content]) => {
  const generation = ++renderGeneration
  if (!show) return
  const { default: MarkdownIt } = await import('markdown-it')
  if (generation === renderGeneration) rendered.value = new MarkdownIt({ html: false, linkify: true }).render(content ?? '')
})
watch(section, value => { if (value === 'arc') view.value = 'arcs'; else if (view.value === 'arcs') view.value = 'write' })
watch(() => active.value?.document.kind, kind => { if (kind) section.value = kind === 'beat' ? 'arc' : kind })

async function select(doc: DocumentSummary) {
  section.value = doc.kind === 'beat' ? 'arc' : doc.kind
  await nextTick()
  view.value = 'write'
  mobileSidebar.value = false
  await run(() => workspace.open(doc.id))
}
function created(doc: DocumentSummary) {
  if (doc.kind === 'arc') { section.value = 'arc'; view.value = 'arcs' }
  else void select(doc)
}
async function createBeat(arc: string, title: string, position: number) {
  await run(async () => {
    const beat = await workspace.create(title, 'Beats')
    const base = metadataOf(beat)
    await workspace.saveDetails(beat.id, { ...base, arcPositions: { [arc]: position } }, base)
  })
}
async function reorder(from: string, to: string) {
  if (!project.value || !from || from === to) return
  const ids = project.value.documents.map(doc => doc.id)
  const sourceIndex = ids.indexOf(from)
  const targetIndex = ids.indexOf(to)
  if (sourceIndex < 0 || targetIndex < 0) return
  ids.splice(sourceIndex, 1)
  ids.splice(targetIndex, 0, from)
  await run(() => workspace.reorder(ids))
}
function shortcut(event: KeyboardEvent) {
  if (event.defaultPrevented) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchOpen.value = true }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void run(workspace.save) }
  if (event.key === 'Escape') focus.value = false
}
onMounted(() => window.addEventListener('keydown', shortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', shortcut))
</script>

<template>
  <div v-if="project" class="flex flex-col flex-1 min-w-0">
    <header class="border-b border-default p-3 flex flex-wrap items-center gap-2">
      <template v-if="!focus">
        <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" @click="run(() => workspace.leaveProject())">Projects</UButton>
        <span class="font-semibold truncate max-w-64 mr-auto">{{ project.settings.title }}</span>
        <UButton color="neutral" variant="ghost" icon="i-lucide-search" aria-label="Search documents" @click="searchOpen = true" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-settings" aria-label="Project settings" @click="settingsOpen = true" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-download" aria-label="Export manuscript" @click="workspace.exportManuscript" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" aria-label="Sync now" @click="run(workspace.refresh)" />
        <UColorModeButton />
        <UButton v-if="passwordRequired" color="neutral" variant="ghost" icon="i-lucide-lock" aria-label="Lock workspace" @click="run(workspace.logout)" />
      </template>
      <UButton color="neutral" :variant="focus ? 'solid' : 'ghost'" :icon="focus ? 'i-lucide-minimize' : 'i-lucide-maximize'" @click="focus = !focus">{{ focus ? 'Exit focus' : 'Focus' }}</UButton>
    </header>
    <UAlert v-if="project.warning" color="warning" :description="project.warning" />
    <UAlert v-if="error" color="error" :description="error" :close="{ onClick: () => error = '' }" role="alert" />
    <div class="flex flex-1 min-w-0">
      <aside v-if="!focus" class="hidden md:block w-72 shrink-0 border-r border-default p-3 overflow-y-auto max-h-[calc(100dvh-4rem)]">
        <USelect v-model="section" :items="sections" aria-label="Section" class="w-full mb-3" />
        <UButton icon="i-lucide-plus" variant="soft" block class="mb-4" @click="createOpen = true">New {{ section }}</UButton>
        <DocumentSidebar :documents="documents" :selected-id="selectedId" :section="currentSection.label" @select="select" @reorder="reorder" />
        <div class="mt-6 space-y-2"><p class="text-xs text-muted">{{ totalWords.toLocaleString() }} / {{ project.settings.wordGoal.toLocaleString() }} words</p><UProgress :model-value="Math.min(totalWords, project.settings.wordGoal || 1)" :max="project.settings.wordGoal || 1" /></div>
      </aside>
      <main class="flex-1 min-w-0 p-4 sm:p-6 space-y-4">
        <div v-if="!focus" class="flex flex-wrap items-center justify-between gap-2">
          <UButton color="neutral" variant="outline" icon="i-lucide-panel-left" class="md:hidden" @click="mobileSidebar = true">Documents</UButton>
          <UTabs v-model="view" :items="tabs" :content="false" class="max-w-full" />
        </div>
        <ArcTimelines v-if="view === 'arcs' && !focus" :arcs="arcs" :beats="beats" :busy="busy" @create="createOpen = true" @open="select" @create-beat="createBeat" @place="(doc, arc, position) => run(() => place(doc, arc, position))" />
        <DocumentCollection v-else-if="(view === 'board' || view === 'outline') && !focus" :documents="documents" :view="view" @select="select" />
        <template v-else-if="active">
          <header class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-xl font-semibold break-words">{{ active.document.title }}</h1><UButton v-if="!focus" color="neutral" variant="outline" icon="i-lucide-panel-right" @click="inspector = true">Details</UButton></header>
          <div class="flex flex-wrap items-center gap-1" aria-label="Editor toolbar">
            <template v-if="!reading"><UButton v-for="action in formatting" :key="action.type" color="neutral" variant="ghost" :icon="action.icon" :aria-label="action.label" :title="action.label" @click="editor?.format(action.type)" /></template>
            <UButton color="neutral" :variant="source ? 'soft' : 'ghost'" :aria-pressed="source" :disabled="reading" @click="source = !source">Source</UButton>
            <UButton color="neutral" :variant="reading ? 'soft' : 'ghost'" :aria-pressed="reading" @click="reading = !reading">{{ reading ? 'Edit' : 'Read' }}</UButton>
            <USelect v-model="fontSize" :items="[14, 16, 18, 20, 24].map(value => ({ label: `${value}px`, value }))" aria-label="Font size" class="ml-auto w-24" />
          </div>
          <UAlert v-if="active.conflict" color="warning" title="This document has conflicting changes" :actions="[{ label: 'Review changes', onClick: () => conflictOpen = true }]" />
          <div class="rounded-lg border border-default overflow-hidden">
            <article v-if="reading" class="document-prose p-4 min-h-96" :style="{ fontSize: `${fontSize}px` }" v-html="rendered" />
            <DocumentEditor v-else ref="editor" :model-value="active.content" :document-id="selectedId" :source="source" :font-size="fontSize" @update:model-value="workspace.edit" @save="run(workspace.save)" />
          </div>
          <footer class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted"><span>{{ words.toLocaleString() }} words<span v-if="notice"> · {{ notice }}</span></span><UButton color="neutral" variant="ghost" :loading="sync.syncing" @click="active?.conflict ? conflictOpen = true : run(workspace.save)">{{ savedState }}</UButton></footer>
        </template>
        <p v-else class="text-muted py-12">Select a document or create one to get started.</p>
      </main>
    </div>
    <USlideover v-model:open="mobileSidebar" side="left" title="Documents" description="Choose a section and document.">
      <template #body><USelect v-model="section" :items="sections" aria-label="Section" class="w-full mb-3" /><UButton icon="i-lucide-plus" variant="soft" block class="mb-4" @click="mobileSidebar = false; createOpen = true">New {{ section }}</UButton><DocumentSidebar :documents="documents" :selected-id="selectedId" :section="currentSection.label" @select="select" @reorder="reorder" /></template>
    </USlideover>
    <USlideover v-model:open="inspector" title="Details" description="Edit document metadata and links.">
      <template #body><DocumentDetails v-if="details" :fields="details.fields" :dirty="details.dirty" :saving="saving" @edit="editDetails" @reset="reset" @save="saveDetails" @open="doc => { inspector = false; select(doc) }" @history="inspector = false; historyOpen = true" @move="inspector = false; moveOpen = true" /></template>
    </USlideover>
    <CreateDocumentModal v-model:open="createOpen" :kind="section" :folder="currentSection.folder" @created="created" />
    <ProjectSettingsModal v-model:open="settingsOpen" />
    <DocumentSearchModal v-model:open="searchOpen" @select="select" />
    <DocumentHistoryModal v-model:open="historyOpen" @restored="view = 'write'; reading = false" />
    <DocumentMoveModal v-model:open="moveOpen" />
    <DocumentConflictModal v-model:open="conflictOpen" />
  </div>
</template>
