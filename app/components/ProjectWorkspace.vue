<script setup lang="ts">
import { countWords, type DocumentSummary, type FolderLayout, type FolderSummary, type FolderView } from '~/models'
import { metadataOf } from '~/composables/useDocumentDetails'
import { folderDocument, folderItems, isDefaultFolder, parentPath, type FolderItem } from '~/services/FolderStructure'
import { isScene } from '~/services/FileNames'

const workspace = useWorkspace()
const { project, active, selectedId, sync, notice, passwordRequired, allowDeletingDefaultFolders } = workspace
const { details, saving, edit: editDetails, reset, save: saveDetails } = useDocumentDetails()
const { busy, error, run } = useTask()
const folderPath = ref('Manuscript')
const currentFolder = computed(() => project.value?.folders.find(folder => folder.path === folderPath.value))
const items = computed(() => project.value ? folderItems(project.value, folderPath.value) : [])
const view = ref<FolderView>('write')
const protectedFolder = computed(() => isDefaultFolder(folderPath.value) && !allowDeletingDefaultFolders.value)
const canRemoveFolder = computed(() => !!folderPath.value && !items.value.length && !protectedFolder.value)
const breadcrumbs = computed(() => ['', ...folderPath.value.split('/').filter(Boolean).map((_, index, parts) => parts.slice(0, index + 1).join('/'))])
const folderOpen = ref(false)
const folderParent = ref('')
const createTarget = ref('')
let keepCollection = false
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
const words = computed(() => countWords(active.value?.content ?? ''))
const totalWords = computed(() => project.value?.documents.filter(doc => isScene(doc.path)).reduce((sum, doc) => sum + (doc.id === selectedId.value ? words.value : doc.wordCount), 0) ?? 0)
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
  { label: 'Grid', value: 'grid', icon: 'i-lucide-grid-3x3' },
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
watch(() => project.value?.folders, folders => {
  if (folders && !folders.some(folder => folder.path === folderPath.value)) folderPath.value = ''
}, { immediate: true })
watch(() => active.value?.document.folder, path => { if (path !== undefined && view.value === 'write') folderPath.value = path }, { immediate: true })

async function select(doc: DocumentSummary) {
  folderPath.value = doc.folder
  view.value = 'write'
  mobileSidebar.value = false
  await run(() => workspace.open(doc.id))
}
function created(doc: DocumentSummary) {
  if (!keepCollection) void select(doc)
}
function newDocument(path = folderPath.value, keep = false) {
  createTarget.value = path
  keepCollection = keep
  createOpen.value = true
}
function newFolder(parent = folderPath.value) { folderParent.value = parent; folderOpen.value = true }
async function openFolder(folder: FolderSummary, preserveView = false) {
  folderPath.value = folder.path
  mobileSidebar.value = false
  if (preserveView) return
  // Opening a folder opens its own document, unless the writer pinned a view for it.
  view.value = folder.pinnedView ?? 'write'
  if (view.value !== 'write') return
  const own = project.value && folderDocument(project.value, folder)
  const first = own ?? project.value?.documents.find(doc => doc.folder === folder.path)
  if (first) await select(first)
  else view.value = 'board'
}
function navigate(path: string) {
  const folder = project.value?.folders.find(folder => folder.path === path)
  if (folder) void openFolder(folder, true)
}
function openItem(item: FolderItem) { if (item.folder) void openFolder(item.folder, true); else void select(item.document) }
async function reorder(path: string, from: string, to: string) {
  if (!project.value || !from || from === to) return
  const ids = folderItems(project.value, path).map(item => item.key)
  const sourceIndex = ids.indexOf(from)
  const targetIndex = ids.indexOf(to)
  if (sourceIndex < 0 || targetIndex < 0) return
  ids.splice(sourceIndex, 1)
  ids.splice(targetIndex, 0, from)
  await run(() => workspace.saveFolderLayout(path, { itemOrder: ids }))
}
const layout = (patch: Partial<FolderLayout>) => run(() => workspace.saveFolderLayout(folderPath.value, patch))
// Linking or unlinking from the grid is an ordinary metadata change on that document.
const assign = (doc: DocumentSummary, links: string[]) => run(() => workspace.saveDetails(doc.id, { ...metadataOf(doc), links }, metadataOf(doc)))
const pin = () => run(() => workspace.saveFolderLayout(folderPath.value, { pinnedView: currentFolder.value?.pinnedView === view.value ? null : view.value }))
const removeFolder = () => run(async () => {
  const path = folderPath.value
  await workspace.removeFolder(path)
  folderPath.value = parentPath(path)
})
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
        <div class="flex items-center justify-between mb-3"><UButton color="neutral" variant="ghost" icon="i-lucide-folders" @click="openFolder(project.folders.find(folder => folder.path === '')!)">All folders</UButton><UButton color="neutral" variant="ghost" icon="i-lucide-folder-plus" aria-label="New top-level folder" @click="newFolder('')" /></div>
        <FolderTree :project="project" path="" :selected-folder="folderPath" :selected-id="selectedId" @folder="openFolder" @document="select" @reorder="reorder" />
        <div class="mt-6 space-y-2"><p class="text-xs text-muted">{{ totalWords.toLocaleString() }} / {{ project.settings.wordGoal.toLocaleString() }} words</p><UProgress :model-value="Math.min(totalWords, project.settings.wordGoal || 1)" :max="project.settings.wordGoal || 1" /></div>
      </aside>
      <main class="flex-1 min-w-0 p-4 sm:p-6 space-y-4">
        <div v-if="!focus" class="flex flex-wrap items-center justify-between gap-2">
          <UButton color="neutral" variant="outline" icon="i-lucide-panel-left" class="md:hidden" @click="mobileSidebar = true">Documents</UButton>
          <UTabs v-model="view" :items="tabs" :content="false" class="max-w-full" />
          <UButton color="neutral" :variant="currentFolder?.pinnedView === view ? 'soft' : 'ghost'" icon="i-lucide-pin" :aria-pressed="currentFolder?.pinnedView === view" :aria-label="currentFolder?.pinnedView === view ? 'Unpin view' : 'Pin view for this folder'" @click="pin" />
        </div>
        <div v-if="!focus" class="flex flex-wrap items-center gap-2">
          <nav aria-label="Folder path" class="flex flex-wrap items-center gap-1 mr-auto"><template v-for="(path, index) in breadcrumbs" :key="path"><UIcon v-if="index" name="i-lucide-chevron-right" class="size-3 text-muted" /><UButton color="neutral" variant="link" @click="navigate(path)">{{ path.split('/').at(-1) || project.settings.title }}</UButton></template></nav>
          <UButton icon="i-lucide-plus" variant="soft" @click="newDocument()">New document</UButton>
          <UButton icon="i-lucide-folder-plus" color="neutral" variant="outline" @click="newFolder()">New folder</UButton>
          <UButton v-if="folderPath" icon="i-lucide-folder-minus" color="neutral" variant="ghost" :disabled="!canRemoveFolder || busy" aria-label="Remove empty folder" :title="protectedFolder ? 'Default folders can be removed once the server setting allows it' : 'Only empty folders can be removed'" @click="removeFolder" />
        </div>
        <GridView v-if="view === 'grid' && !focus" :project="project" :path="folderPath" @open="openItem" @layout="layout" @assign="assign" @create-document="path => newDocument(path, true)" />
        <CollectionView v-else-if="(view === 'board' || view === 'outline') && !focus" :items="items" :path="folderPath" :view="view" @open="openItem" @reorder="reorder" />
        <template v-else-if="active && (active.document.folder === folderPath || focus)">
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
    <USlideover v-model:open="mobileSidebar" side="left" title="Documents" description="Browse every folder and document.">
      <template #body><div class="flex justify-between mb-3"><UButton color="neutral" variant="ghost" @click="openFolder(project.folders.find(folder => folder.path === '')!)">All folders</UButton><UButton icon="i-lucide-folder-plus" aria-label="New top-level folder" @click="mobileSidebar = false; newFolder('')" /></div><FolderTree :project="project" path="" :selected-folder="folderPath" :selected-id="selectedId" @folder="openFolder" @document="select" @reorder="reorder" /></template>
    </USlideover>
    <USlideover v-model:open="inspector" title="Details" description="Edit document metadata and links.">
      <template #body><DocumentDetails v-if="details" :fields="details.fields" :dirty="details.dirty" :saving="saving" @edit="editDetails" @reset="reset" @save="saveDetails" @open="doc => { inspector = false; select(doc) }" @history="inspector = false; historyOpen = true" @move="inspector = false; moveOpen = true" /></template>
    </USlideover>
    <CreateDocumentModal v-model:open="createOpen" kind="document" :folder="createTarget" @created="created" />
    <CreateFolderModal v-model:open="folderOpen" :parent="folderParent" />
    <ProjectSettingsModal v-model:open="settingsOpen" />
    <DocumentSearchModal v-model:open="searchOpen" @select="select" />
    <DocumentHistoryModal v-model:open="historyOpen" @restored="view = 'write'; reading = false" />
    <DocumentMoveModal v-model:open="moveOpen" />
    <DocumentConflictModal v-model:open="conflictOpen" />
  </div>
</template>
