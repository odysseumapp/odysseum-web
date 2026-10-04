<script setup lang="ts">
import { WRITE_VIEW, detailsOf, type DocumentDetails, type DocumentSummary, type Folder, type FolderView, type ViewSettings } from '~/models'
import { findDocument, findFolder, folderChain, folderDocument, folderItems, isDefaultFolder, isScene, rootFolder } from '~/services/FolderStructure'
import { compileStyles, cssOf, isStyleDocument } from '~/services/Styles'

const workspace = useWorkspace()
const { project, active, selectedId, sync, notice, passwordRequired, allowDeletingDefaultFolders } = workspace
const { details, saving, edit: editDetails, reset, save: saveDetails } = useDocumentDetails()
const { busy, error, run } = useTask()
const folderId = ref('')
const currentFolder = computed(() => project.value ? findFolder(project.value, folderId.value) : undefined)
const items = computed(() => project.value ? folderItems(project.value, folderId.value) : [])
const view = ref<FolderView>(WRITE_VIEW)
const registry = useViews()
/** The editor, then the views that plugins registered, in the order they registered. */
const views = computed(() => [{ name: WRITE_VIEW, label: 'Write' }, ...registry.views.map(item => ({ name: item.name, label: item.label }))])
const pluginView = computed(() => registry.find(view.value))
const known = (name: string | null | undefined): name is string => name === WRITE_VIEW || !!registry.find(name)
const tabs = computed(() => views.value.map(item => ({ label: item.label, value: item.name, icon: item.name === WRITE_VIEW ? 'i-lucide-file-text' : undefined })))
/** A plugin's SVG icon, painted in the text color so that it follows the theme. */
const iconMask = (url: string) => ({ mask: `url(${JSON.stringify(url)}) center / contain no-repeat` })
const viewSettings = computed<ViewSettings>(() => currentFolder.value?.views[view.value] ?? {})
const isRoot = computed(() => !!currentFolder.value && !currentFolder.value.parentFolderId)
const protectedFolder = computed(() => !!project.value && !!currentFolder.value && isDefaultFolder(project.value, currentFolder.value) && !allowDeletingDefaultFolders.value)
const canRemoveFolder = computed(() => !!currentFolder.value && !isRoot.value && !currentFolder.value.childIds.length && !protectedFolder.value)
const breadcrumbs = computed(() => project.value ? folderChain(project.value, folderId.value) : [])
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
const templateOpen = ref(false)
const versionsOpen = ref(false)
const themeOpen = ref(false)
const historyOpen = ref(false)
const moveOpen = ref(false)
const conflictOpen = ref(false)
const editor = ref<{ format: (type: string) => void; setStyle: (name: string) => void; style: string }>()
const styles = computed(() => compileStyles((project.value?.documents ?? []).filter(isStyleDocument).map(doc => cssOf(workspace.textOf(doc.id)))))
// A select item cannot have an empty value, so "No style" has its own.
const NO_STYLE = '-'
const styleItems = computed(() => [{ label: 'No style', value: NO_STYLE }, ...styles.value.names.map(name => ({ label: name, value: name }))])
useHead({ style: [{ key: 'project-styles', textContent: () => styles.value.css }] })
// The server counts words; the count changes when an edit is saved.
const words = computed(() => active.value?.document.wordCount ?? 0)
const totalWords = computed(() => project.value?.documents.filter(isScene).reduce((sum, doc) => sum + doc.wordCount, 0) ?? 0)
const savedState = computed(() => {
  if (active.value?.conflict) return 'Review changes'
  if (active.value?.error || sync.value.error) return 'Save interrupted'
  if (!active.value || !workspace.dirty(active.value)) return sync.value.pending ? 'Changes pending' : 'All changes saved'
  return sync.value.online ? 'Saving…' : 'Saved on this device'
})
const formatting = [
  { type: 'undo', label: 'Undo', icon: 'i-lucide-undo-2' }, { type: 'redo', label: 'Redo', icon: 'i-lucide-redo-2' },
  { type: 'bold', label: 'Bold', icon: 'i-lucide-bold' }, { type: 'italic', label: 'Italic', icon: 'i-lucide-italic' },
  { type: 'heading', label: 'Heading', icon: 'i-lucide-heading-2' }, { type: 'quote', label: 'Blockquote', icon: 'i-lucide-quote' },
  { type: 'list', label: 'Bulleted list', icon: 'i-lucide-list' }, { type: 'tasks', label: 'Checklist', icon: 'i-lucide-list-checks' },
  { type: 'highlight', label: 'Highlight', icon: 'i-lucide-highlighter' }, { type: 'table', label: 'Table', icon: 'i-lucide-table' },
  { type: 'break', label: 'Scene break', icon: 'i-lucide-minus' },
]

/** Starts in Manuscript, or the top folder; goes to the top folder when the open folder is removed. */
watch(() => project.value?.folders, folders => {
  if (!folders || !project.value || folders.some(folder => folder.id === folderId.value)) return
  const top = rootFolder(project.value)
  folderId.value = folders.find(folder => folder.parentFolderId === top?.id && folder.name === 'Manuscript')?.id ?? top?.id ?? ''
}, { immediate: true })
watch(() => active.value?.document.folderId, id => { if (id !== undefined && view.value === WRITE_VIEW) folderId.value = id }, { immediate: true })
watch(views, () => { if (!known(view.value)) view.value = WRITE_VIEW })
/** A folder pinned to a view from a plugin that loads late opens in it once the plugin has registered. */
watch(() => registry.views.length, () => { if (view.value === WRITE_VIEW && known(currentFolder.value?.pinnedView) && !active.value) view.value = currentFolder.value!.pinnedView! })
watch([view, folderId], async () => {
  if (view.value !== WRITE_VIEW || !project.value || active.value?.document.folderId === folderId.value) return
  const folder = currentFolder.value
  const own = folder && folderDocument(project.value, folder)
  const first = own ?? items.value.find(item => item.document)?.document
  if (first) await select(first)
  else view.value = views.value.find(item => item.name !== WRITE_VIEW)?.name ?? WRITE_VIEW
})

async function select(doc: DocumentSummary, write = true) {
  folderId.value = doc.folderId
  if (write) view.value = WRITE_VIEW
  mobileSidebar.value = false
  await run(() => workspace.open(doc.id))
}
function created(doc: DocumentSummary) {
  if (!keepCollection) void select(doc)
}
function newDocument(target = folderId.value, keep = false) {
  createTarget.value = target
  keepCollection = keep
  createOpen.value = true
}
function newFolder(parent = folderId.value) { folderParent.value = parent; folderOpen.value = true }
function openFolder(folder: Folder) {
  folderId.value = folder.id
  mobileSidebar.value = false
  if (known(folder.pinnedView)) view.value = folder.pinnedView
  else if (folder.pinnedView) view.value = WRITE_VIEW
}
function openItem(id: string) {
  if (!project.value) return
  const folder = findFolder(project.value, id)
  if (folder) return openFolder(folder)
  const doc = findDocument(project.value, id)
  if (doc) void select(doc)
}
function reorder(parentId: string, from: string, to: string) {
  const index = project.value ? findFolder(project.value, parentId)?.childIds.indexOf(to) ?? -1 : -1
  if (from !== to && index >= 0) void run(() => workspace.move(from, parentId, index))
}
const move = (itemId: string, targetFolderId: string, index: number) => run(() => workspace.move(itemId, targetFolderId, index))
const saveViewSettings = (settings: ViewSettings | null) => run(() => workspace.updateLayout(folderId.value, { views: { [view.value]: settings } }))
function updateDetails(documentId: string, patch: Partial<DocumentDetails>) {
  const doc = project.value && findDocument(project.value, documentId)
  if (doc) void run(() => workspace.saveDetails(doc.id, { ...detailsOf(doc), ...patch }, detailsOf(doc)))
}
const link = (a: string, b: string) => run(() => workspace.link(a, b))
const unlink = (linkId: string) => run(() => workspace.unlink(linkId))
const setLinkNote = (linkId: string, note: string) => run(() => workspace.setLinkNote(linkId, note))
const pin = () => run(() => workspace.updateLayout(folderId.value, { pinnedView: currentFolder.value?.pinnedView === view.value ? null : view.value }))
const removeFolder = () => run(async () => {
  const parent = currentFolder.value?.parentFolderId
  await workspace.removeFolder(folderId.value)
  if (parent) folderId.value = parent
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
        <span class="font-semibold truncate max-w-64 mr-auto">{{ project.project.title }}</span>
        <UButton color="neutral" variant="ghost" icon="i-lucide-search" aria-label="Search documents" @click="searchOpen = true" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-settings" aria-label="Project settings" @click="settingsOpen = true" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-layout-template" aria-label="Project templates" @click="templateOpen = true" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-history" aria-label="Project versions" @click="versionsOpen = true" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-download" aria-label="Export manuscript" @click="workspace.exportManuscript" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" aria-label="Sync now" @click="run(workspace.refresh)" />
        <UButton color="neutral" variant="ghost" icon="i-lucide-palette" aria-label="Appearance" @click="themeOpen = true" />
        <UColorModeButton />
        <UButton v-if="passwordRequired" color="neutral" variant="ghost" icon="i-lucide-lock" aria-label="Lock workspace" @click="run(workspace.logout)" />
      </template>
      <UButton color="neutral" :variant="focus ? 'solid' : 'ghost'" :icon="focus ? 'i-lucide-minimize' : 'i-lucide-maximize'" @click="focus = !focus">{{ focus ? 'Exit focus' : 'Focus' }}</UButton>
    </header>
    <UAlert v-if="project.project.warning" color="warning" :description="project.project.warning" />
    <UAlert v-if="error" color="error" :description="error" :close="{ onClick: () => error = '' }" role="alert" />
    <div class="flex flex-1 min-w-0">
      <aside v-if="!focus" class="hidden md:block w-72 shrink-0 border-r border-default p-3 overflow-y-auto max-h-[calc(100dvh-4rem)]">
        <div class="flex items-center justify-between mb-3"><UButton color="neutral" variant="ghost" icon="i-lucide-folders" @click="openFolder(rootFolder(project)!)">All folders</UButton><UButton color="neutral" variant="ghost" icon="i-lucide-folder-plus" aria-label="New top-level folder" @click="newFolder(project.project.rootFolderId)" /></div>
        <FolderTree :project="project" :folder-id="project.project.rootFolderId" :selected-folder="folderId" :selected-id="selectedId" @folder="openFolder" @document="doc => select(doc, false)" @reorder="reorder" />
        <div class="mt-6 space-y-2"><p class="text-xs text-muted">{{ totalWords.toLocaleString() }} / {{ project.project.wordGoal.toLocaleString() }} words</p><UProgress :model-value="Math.min(totalWords, project.project.wordGoal || 1)" :max="project.project.wordGoal || 1" /></div>
      </aside>
      <main class="flex-1 min-w-0 p-4 sm:p-6 space-y-4">
        <div v-if="!focus" class="flex flex-wrap items-center justify-between gap-2">
          <UButton color="neutral" variant="outline" icon="i-lucide-panel-left" class="md:hidden" @click="mobileSidebar = true">Documents</UButton>
          <UTabs v-model="view" :items="tabs" :content="false" class="max-w-full">
            <template #leading="{ item }"><UIcon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" /><span v-else-if="registry.find(item.value)?.icon" class="size-4 shrink-0 bg-current" :style="iconMask(registry.find(item.value)!.icon!)" aria-hidden="true" /></template>
          </UTabs>
          <UButton color="neutral" :variant="currentFolder?.pinnedView === view ? 'soft' : 'ghost'" icon="i-lucide-pin" :aria-pressed="currentFolder?.pinnedView === view" :aria-label="currentFolder?.pinnedView === view ? 'Unpin view' : 'Pin view for this folder'" @click="pin" />
        </div>
        <div v-if="!focus" class="flex flex-wrap items-center gap-2">
          <nav aria-label="Folder path" class="flex flex-wrap items-center gap-1 mr-auto"><template v-for="(folder, index) in breadcrumbs" :key="folder.id"><UIcon v-if="index" name="i-lucide-chevron-right" class="size-3 text-muted" /><UButton color="neutral" variant="link" @click="openFolder(folder)">{{ folder.parentFolderId ? folder.name : project.project.title }}</UButton></template></nav>
          <UButton icon="i-lucide-plus" variant="soft" @click="newDocument()">New document</UButton>
          <UButton icon="i-lucide-folder-plus" color="neutral" variant="outline" @click="newFolder()">New folder</UButton>
          <UButton v-if="!isRoot" icon="i-lucide-folder-minus" color="neutral" variant="ghost" :disabled="!canRemoveFolder || busy" aria-label="Remove empty folder" :title="protectedFolder ? 'Default folders can be removed once the server setting allows it' : 'Only empty folders can be removed'" @click="removeFolder" />
        </div>
        <component
          :is="pluginView.component" v-if="pluginView && !focus && currentFolder" :key="`${pluginView.name}:${currentFolder.id}`"
          :folder="currentFolder" :items="items" :settings="viewSettings" :project="project"
          @open="openItem" @move="move" @save-settings="saveViewSettings" @update-details="updateDetails"
          @link="link" @unlink="unlink" @set-link-note="setLinkNote" @create-document="(id: string) => newDocument(id, true)"
        />
        <template v-else-if="active && (active.document.folderId === folderId || focus)">
          <header class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-xl font-semibold break-words">{{ active.document.title }}</h1><UButton v-if="!focus" color="neutral" variant="outline" icon="i-lucide-panel-right" @click="inspector = true">Details</UButton></header>
          <div class="flex flex-wrap items-center gap-1" aria-label="Editor toolbar">
            <template v-if="!reading"><UButton v-for="action in formatting" :key="action.type" color="neutral" variant="ghost" :icon="action.icon" :aria-label="action.label" :title="action.label" @click="editor?.format(action.type)" /></template>
            <UButton color="neutral" :variant="source ? 'soft' : 'ghost'" :aria-pressed="source" :disabled="reading" @click="source = !source">Source</UButton>
            <UButton color="neutral" :variant="reading ? 'soft' : 'ghost'" :aria-pressed="reading" @click="reading = !reading">{{ reading ? 'Edit' : 'Read' }}</UButton>
            <USelect v-if="!reading" :model-value="editor?.style || NO_STYLE" :items="styleItems" aria-label="Style" class="ml-auto w-40" @update:model-value="editor?.setStyle($event === NO_STYLE ? '' : $event)" />
            <USelect v-model="fontSize" :items="[14, 16, 18, 20, 24].map(value => ({ label: `${value}px`, value }))" aria-label="Font size" class="w-24" :class="{ 'ml-auto': reading }" />
          </div>
          <UAlert v-if="active.conflict" color="warning" title="This document has conflicting changes" :actions="[{ label: 'Review changes', onClick: () => conflictOpen = true }]" />
          <div class="rounded-lg border border-default overflow-hidden">
            <DocumentEditor ref="editor" :model-value="active.text" :document-id="selectedId" :source="source" :focus="focus" :editable="!reading" :font-size="fontSize" @update:model-value="workspace.edit" @save="run(workspace.save)" />
          </div>
          <footer class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted"><span>{{ words.toLocaleString() }} words<span v-if="notice"> · {{ notice }}</span></span><UButton color="neutral" variant="ghost" :loading="sync.syncing" @click="active?.conflict ? conflictOpen = true : run(workspace.save)">{{ savedState }}</UButton></footer>
        </template>
        <p v-else-if="view === 'write' && !items.length" class="text-muted py-12">This folder is empty. Add a document or subfolder.</p>
        <p v-else class="text-muted py-12">Select a document or create one to get started.</p>
      </main>
    </div>
    <USlideover v-model:open="mobileSidebar" side="left" title="Documents" description="Browse every folder and document.">
      <template #body><div class="flex justify-between mb-3"><UButton color="neutral" variant="ghost" @click="openFolder(rootFolder(project)!)">All folders</UButton><UButton icon="i-lucide-folder-plus" aria-label="New top-level folder" @click="mobileSidebar = false; newFolder(project.project.rootFolderId)" /></div><FolderTree :project="project" :folder-id="project.project.rootFolderId" :selected-folder="folderId" :selected-id="selectedId" @folder="openFolder" @document="doc => select(doc, false)" @reorder="reorder" /></template>
    </USlideover>
    <USlideover v-model:open="inspector" title="Details" description="Edit document details and links.">
      <template #body><DocumentDetails v-if="details" :fields="details.fields" :dirty="details.dirty" :saving="saving" @edit="editDetails" @reset="reset" @save="saveDetails" @open="doc => { inspector = false; select(doc) }" @history="inspector = false; historyOpen = true" @move="inspector = false; moveOpen = true" /></template>
    </USlideover>
    <CreateDocumentModal v-model:open="createOpen" kind="document" :folder-id="createTarget" @created="created" />
    <CreateFolderModal v-model:open="folderOpen" :parent-id="folderParent" />
    <ProjectSettingsModal v-model:open="settingsOpen" />
    <ProjectTemplateModal v-model:open="templateOpen" />
    <ProjectVersionsModal v-model:open="versionsOpen" @restored="view = 'write'; reading = false" />
    <ThemeModal v-model:open="themeOpen" />
    <DocumentSearchModal v-model:open="searchOpen" @select="select" />
    <DocumentHistoryModal v-model:open="historyOpen" @restored="view = 'write'; reading = false" />
    <DocumentMoveModal v-model:open="moveOpen" />
    <DocumentConflictModal v-model:open="conflictOpen" />
  </div>
</template>
