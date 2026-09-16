<script setup lang="ts">
import type { DocumentSummary, FolderLayout, FolderSummary, Project } from '~/models'
import { descendantDocuments, folderItems, gridColumnFolder, kindIcons, linked, type FolderItem } from '~/services/FolderStructure'
const props = defineProps<{ project: Project; path: string }>()
const emit = defineEmits<{ open: [item: FolderItem]; layout: [patch: Partial<FolderLayout>]; assign: [doc: DocumentSummary, links: string[]]; createDocument: [path: string] }>()
const folder = computed(() => props.project.folders.find(item => item.path === props.path))
// Columns are every document of one other folder: Threads unless you are in it, then Manuscript.
const columnFolder = computed(() => gridColumnFolder(props.project, props.path))
const columns = computed(() => columnFolder.value ? descendantDocuments(props.project, columnFolder.value.path) : [])
const folderChoices = computed(() => props.project.folders.filter(item => item.path && item.path !== props.path).map(item => ({ label: item.path, value: item.id })))
/** Rows are this folder's documents in order; each subfolder is a group that collapses into a roll-up of its members. */
type Row = { doc: DocumentSummary; depth: number; group?: never; members?: never } | { group: FolderSummary; depth: number; members: DocumentSummary[]; doc?: never }
const collapsed = ref(new Set<string>())
const rows = computed<Row[]>(() => {
  const walk = (path: string, depth: number): Row[] => folderItems(props.project, path).flatMap(item => item.document
    ? [{ doc: item.document, depth }]
    : [{ group: item.folder, depth, members: descendantDocuments(props.project, item.folder.path) }, ...(collapsed.value.has(item.folder.path) ? [] : walk(item.folder.path, depth + 1))])
  return walk(props.path, 0)
})
function toggleGroup(path: string) {
  if (collapsed.value.has(path)) collapsed.value.delete(path)
  else collapsed.value.add(path)
}
const itemOf = (doc: DocumentSummary): FolderItem => ({ key: doc.id, title: doc.title, document: doc })
// Links are undirected; send the complete set so the other side is kept in step.
const allLinks = (doc: DocumentSummary) => Array.from(new Set([...doc.links, ...props.project.documents.filter(other => other.links.includes(doc.id)).map(other => other.id)]))
function toggle(doc: DocumentSummary, col: DocumentSummary) {
  const links = allLinks(doc)
  emit('assign', doc, linked(doc, col) ? links.filter(id => id !== col.id) : [...links, col.id])
}
const choose = (id: unknown) => { if (typeof id === 'string' && id !== columnFolder.value?.id) emit('layout', { gridFolder: id }) }
</script>

<template>
  <div class="space-y-4 min-w-0">
    <div class="flex flex-wrap items-center gap-2">
      <p class="text-sm text-muted mr-auto">Rows are the documents in {{ folder?.name || 'the project' }}; columns are the documents in the folder you pick. A mark sits where the two are linked.</p>
      <USelect :model-value="columnFolder?.id ?? ''" :items="folderChoices" aria-label="Columns from folder" class="w-56" @update:model-value="choose" />
      <UButton v-if="columnFolder" icon="i-lucide-plus" variant="soft" @click="emit('createDocument', columnFolder.path)">New in {{ columnFolder.name }}</UButton>
    </div>
    <p v-if="!rows.length" class="text-muted py-8">This folder is empty. Add a document or subfolder.</p>
    <p v-else-if="!columns.length" class="text-muted py-8">{{ columnFolder ? `${columnFolder.name} has no documents yet.` : 'Add another folder to compare against.' }}</p>
    <div v-else class="overflow-auto rounded-lg border border-default max-h-[65dvh]">
      <table class="border-collapse text-sm" aria-label="Grid">
        <thead>
          <tr>
            <th class="sticky top-0 left-0 z-20 bg-default border-b border-r border-default min-w-56 p-2"><span class="sr-only">Document</span></th>
            <th v-for="col in columns" :key="col.id" scope="col" class="sticky top-0 z-10 bg-default border-b border-r border-default min-w-40 p-2 align-top text-left font-normal">
              <button type="button" class="flex items-center gap-2 w-full text-left font-medium focus-visible:outline-2 focus-visible:outline-primary" :aria-label="`Open ${col.title}`" @click="emit('open', itemOf(col))">
                <UIcon :name="kindIcons[col.kind]" class="size-4 shrink-0 text-primary" /><span class="truncate">{{ col.title }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.group ? `group:${row.group.path}` : row.doc.id">
            <template v-if="row.group">
              <th scope="row" class="sticky left-0 z-10 bg-elevated border-b border-r border-default p-2 text-left font-medium" :style="{ paddingLeft: `${8 + row.depth * 16}px` }">
                <div class="flex items-center gap-1">
                  <UButton color="neutral" variant="ghost" size="xs" :icon="collapsed.has(row.group.path) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" :aria-label="`${collapsed.has(row.group.path) ? 'Expand' : 'Collapse'} ${row.group.name}`" :aria-expanded="!collapsed.has(row.group.path)" @click="toggleGroup(row.group.path)" />
                  <UButton color="neutral" variant="link" class="min-w-0" :aria-label="`Open folder ${row.group.name}`" @click="emit('open', { key: `folder:${row.group.name}`, title: row.group.name, folder: row.group })"><span class="truncate">{{ row.group.name }}</span></UButton>
                  <span class="text-xs text-muted ml-auto">{{ row.members.length }}</span>
                </div>
              </th>
              <td v-for="col in columns" :key="col.id" class="relative bg-elevated border-b border-r border-default p-2 align-middle">
                <div class="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-primary/30" aria-hidden="true" />
                <div v-if="collapsed.has(row.group.path)" class="relative flex flex-wrap gap-1">
                  <UButton v-for="doc in row.members.filter(member => linked(member, col))" :key="doc.id" size="xs" color="primary" variant="soft" class="max-w-full" :aria-label="`Open ${doc.title}`" @click="emit('open', itemOf(doc))"><span class="truncate">{{ doc.title }}</span></UButton>
                </div>
              </td>
            </template>
            <template v-else>
              <th scope="row" class="sticky left-0 z-10 bg-default border-b border-r border-default p-2 align-middle text-left font-normal" :style="{ paddingLeft: `${8 + row.depth * 16}px` }">
                <CollectionCard :item="itemOf(row.doc)" compact @open="emit('open', itemOf(row.doc))" />
              </th>
              <td v-for="col in columns" :key="col.id" class="relative border-b border-r border-default p-2 align-middle">
                <div class="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-primary/30" aria-hidden="true" />
                <div v-if="col.id === row.doc.id" class="relative" />
                <div v-else-if="linked(row.doc, col)" class="relative mx-auto flex items-center gap-1 rounded-md border border-primary bg-default px-2 py-1 max-w-full w-fit">
                  <UIcon name="i-lucide-circle-check" class="size-4 shrink-0 text-primary" /><span class="truncate text-xs">{{ col.title }}</span>
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`Unlink ${row.doc.title} from ${col.title}`" @click="toggle(row.doc, col)" />
                </div>
                <UButton v-else size="xs" color="neutral" variant="outline" icon="i-lucide-plus" class="relative mx-auto flex bg-default" :aria-label="`Link ${row.doc.title} to ${col.title}`" :title="`Link ${row.doc.title} to ${col.title}`" @click="toggle(row.doc, col)" />
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
