<script setup lang="ts">
import type { DocumentSummary, FolderLayout, FolderSummary, GridAxis, Project } from '~/models'
import { descendantDocuments, documentChoices, folderItems, kindIcons, kindLabels, linked, resolveColumn, type FolderItem } from '~/services/FolderStructure'
const props = defineProps<{ project: Project; path: string }>()
const emit = defineEmits<{ open: [item: FolderItem]; layout: [patch: Partial<FolderLayout>]; assign: [doc: DocumentSummary, links: string[]]; createDocument: [path: string] }>()
/** One side of the grid: a row document, or a column item (with the layout key it came from), depending on the axis. */
type Head = { row: DocumentSummary; item?: never; source?: never } | { item: FolderItem; source?: string; row?: never }
const folder = computed(() => props.project.folders.find(item => item.path === props.path))
const byId = computed(() => new Map(props.project.documents.map(doc => [doc.id, doc])))
// Rows are whatever the writer added: threads, characters, locations… A row whose document is gone drops out until the layout is saved again.
const rowDocs = computed(() => (folder.value?.rows ?? []).flatMap(id => { const doc = byId.value.get(id); return doc ? [doc] : [] }))
const custom = computed(() => (folder.value?.columns.length ?? 0) > 0)
const columnHeads = computed<Head[]>(() => custom.value
  ? (folder.value?.columns ?? []).flatMap(source => resolveColumn(props.project, source).map(item => ({ item, source })))
  : folderItems(props.project, props.path).map(item => ({ item })))
const axis = computed<GridAxis>(() => folder.value?.axis ?? 'rows')
const rows = computed<Head[]>(() => axis.value === 'rows' ? rowDocs.value.map(row => ({ row })) : columnHeads.value)
const columns = computed<Head[]>(() => axis.value === 'rows' ? columnHeads.value : rowDocs.value.map(row => ({ row })))
const keyOf = (head: Head) => head.row ? `row:${head.row.id}` : `${head.source ?? ''}:${head.item.key}`
const cell = (a: Head, b: Head) => ({ row: (a.row ?? b.row)!, item: (a.item ?? b.item)! })
const members = (item: FolderSummary, row: DocumentSummary) => descendantDocuments(props.project, item.path).filter(doc => linked(doc, row))
const choice = (doc: DocumentSummary) => ({ label: `${doc.title} · ${kindLabels[doc.kind]}`, value: doc.id, icon: kindIcons[doc.kind] })
const rowChoices = computed(() => documentChoices(props.project).filter(doc => !rowDocs.value.includes(doc)).map(choice))
const columnChoices = computed(() => {
  const taken = new Set(folder.value?.columns ?? [])
  const folders = props.project.folders.filter(item => item.path).flatMap(item => [
    { label: `${item.path} · folder`, value: item.id, icon: 'i-lucide-folder' },
    { label: `${item.path} · each document`, value: `${item.id}/*`, icon: 'i-lucide-list' },
  ])
  return [...folders, ...documentChoices(props.project).map(choice)].filter(option => !taken.has(option.value))
})
const picker = ref<{ folder: FolderSummary; row: DocumentSummary } | null>(null)
const pickerOpen = computed({ get: () => !!picker.value, set: (open: boolean) => { if (!open) picker.value = null } })
const choices = computed(() => picker.value ? descendantDocuments(props.project, picker.value.folder.path).filter(doc => doc.id !== picker.value!.row.id) : [])
// Links are undirected; send the complete set so the other side is kept in step.
const allLinks = (doc: DocumentSummary) => Array.from(new Set([...doc.links, ...props.project.documents.filter(other => other.links.includes(doc.id)).map(other => other.id)]))
function toggle(doc: DocumentSummary, row: DocumentSummary) {
  const links = allLinks(doc)
  emit('assign', doc, linked(doc, row) ? links.filter(id => id !== row.id) : [...links, row.id])
}
function addRow(id: unknown) {
  if (typeof id === 'string' && id) emit('layout', { rows: [...(folder.value?.rows ?? []), id] })
}
const removeRow = (id: string) => emit('layout', { rows: (folder.value?.rows ?? []).filter(row => row !== id) })
function addColumn(key: unknown) {
  if (typeof key !== 'string' || !key) return
  // The first added column makes the implicit children explicit, so nothing disappears.
  const current = folder.value?.columns.length ? folder.value.columns : folderItems(props.project, props.path).map(item => item.folder ? item.folder.id : item.document.id)
  emit('layout', { columns: [...current, key] })
}
const removeColumn = (source: string) => emit('layout', { columns: (folder.value?.columns ?? []).filter(column => column !== source) })
const swap = () => emit('layout', { axis: axis.value === 'rows' ? 'columns' : 'rows' })
</script>

<template>
  <div class="space-y-4 min-w-0">
    <div class="flex flex-wrap items-center gap-2">
      <p class="text-sm text-muted mr-auto">Rows are threads, characters, locations — anything. Columns are {{ custom ? 'what you chose' : `what is in ${folder?.name || 'this folder'}` }}. A card sits where the two are linked.</p>
      <USelect :model-value="''" :items="rowChoices" placeholder="Add row" aria-label="Add row" :disabled="!rowChoices.length" class="w-56" @update:model-value="addRow" />
      <USelect :model-value="''" :items="columnChoices" placeholder="Add column" aria-label="Add column" :disabled="!columnChoices.length" class="w-56" @update:model-value="addColumn" />
      <UButton v-if="custom" color="neutral" variant="outline" icon="i-lucide-folder" aria-label="Use folder items as columns" @click="emit('layout', { columns: [] })">Folder items</UButton>
      <UButton color="neutral" variant="outline" icon="i-lucide-arrow-left-right" aria-label="Swap rows and columns" @click="swap">Swap</UButton>
      <UButton icon="i-lucide-plus" variant="soft" @click="emit('createDocument', 'Threads')">New thread</UButton>
    </div>
    <p v-if="!rowDocs.length" class="text-muted py-8">Add a row — a thread, a character, a location — to see where it runs through {{ folder?.name || 'the project' }}.</p>
    <div v-else class="overflow-auto rounded-lg border border-default max-h-[65dvh]">
      <table class="border-collapse text-sm" aria-label="Grid">
        <thead>
          <tr>
            <th class="sticky top-0 left-0 z-20 bg-default border-b border-r border-default min-w-44 p-2"><span class="sr-only">{{ axis === 'rows' ? 'Row' : 'Column' }}</span></th>
            <th v-for="col in columns" :key="keyOf(col)" scope="col" class="sticky top-0 z-10 bg-default border-b border-r border-default min-w-44 p-2 align-top text-left font-normal">
              <CollectionCard v-if="col.item" :item="col.item" compact @open="emit('open', col.item)">
                <UButton v-if="col.source && !col.source.endsWith('/*')" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${col.item.title} column`" @click="removeColumn(col.source)">Remove</UButton>
              </CollectionCard>
              <CollectionCard v-else :item="{ key: col.row.id, title: col.row.title, document: col.row }" compact @open="emit('open', { key: col.row.id, title: col.row.title, document: col.row })">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${col.row.title} row`" @click="removeRow(col.row.id)">Remove</UButton>
              </CollectionCard>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="keyOf(row)">
            <th scope="row" class="sticky left-0 z-10 bg-default border-b border-r border-default min-w-44 p-2 align-top text-left font-normal">
              <CollectionCard v-if="row.item" :item="row.item" compact @open="emit('open', row.item)">
                <UButton v-if="row.source && !row.source.endsWith('/*')" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${row.item.title} column`" @click="removeColumn(row.source)">Remove</UButton>
              </CollectionCard>
              <CollectionCard v-else :item="{ key: row.row.id, title: row.row.title, document: row.row }" compact @open="emit('open', { key: row.row.id, title: row.row.title, document: row.row })">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${row.row.title} row`" @click="removeRow(row.row.id)">Remove</UButton>
              </CollectionCard>
            </th>
            <td v-for="col in columns" :key="keyOf(col)" class="relative border-b border-r border-default p-3 min-w-48" :class="axis === 'rows' ? 'align-middle' : 'align-top'">
              <div class="absolute bg-primary/40" :class="axis === 'rows' ? 'inset-x-0 top-1/2 h-1 -translate-y-1/2' : 'inset-y-0 left-1/2 w-1 -translate-x-1/2'" aria-hidden="true" />
              <template v-for="{ row: line, item } in [cell(row, col)]" :key="line.id">
                <div v-if="item.folder" class="relative space-y-3">
                  <CollectionCard v-for="doc in members(item.folder, line)" :key="doc.id" :item="{ key: doc.id, title: doc.title, document: doc }" @open="emit('open', { key: doc.id, title: doc.title, document: doc })">
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${doc.title} from ${line.title}`" @click="toggle(doc, line)">Remove</UButton>
                  </CollectionCard>
                  <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-plus" class="mx-auto flex bg-default" :aria-label="`Choose documents in ${item.folder.name} for ${line.title}`" @click="picker = { folder: item.folder, row: line }">{{ members(item.folder, line).length ? 'Change' : 'Choose' }}</UButton>
                </div>
                <div v-else-if="item.document.id === line.id" class="relative" />
                <CollectionCard v-else-if="linked(item.document, line)" :item="item" class="relative" @open="emit('open', item)">
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${item.document.title} from ${line.title}`" @click="toggle(item.document, line)">Remove</UButton>
                </CollectionCard>
                <UButton v-else size="xs" color="neutral" variant="outline" icon="i-lucide-plus" class="relative mx-auto flex bg-default" :aria-label="`Add ${item.document.title} to ${line.title}`" :title="`Add ${item.document.title} to ${line.title}`" @click="toggle(item.document, line)" />
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <UModal v-model:open="pickerOpen" :title="picker ? `${picker.row.title} through ${picker.folder.name}` : 'Choose documents'" description="Tick the documents linked to this row.">
      <template #body>
        <div v-if="picker" class="space-y-2">
          <UCheckbox v-for="doc in choices" :key="doc.id" :model-value="linked(doc, picker.row)" :label="doc.title" @update:model-value="toggle(doc, picker.row)" />
          <p v-if="!choices.length" class="text-sm text-muted">This folder has no documents.</p>
        </div>
      </template>
    </UModal>
  </div>
</template>
