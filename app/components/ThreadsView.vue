<script setup lang="ts">
import type { DocumentSummary, FolderLayout, FolderSummary, Project, ThreadAxis } from '~/models'
import { descendantDocuments, folderItems, threadDocuments, type FolderItem } from '~/services/FolderStructure'
const props = defineProps<{ project: Project; path: string }>()
const emit = defineEmits<{ open: [item: FolderItem]; layout: [patch: Partial<FolderLayout>]; assign: [doc: DocumentSummary, threads: string[]]; createDocument: [path: string] }>()
/** One side of the grid: either a thread or an item of the current folder, depending on the axis. */
type Head = { thread: DocumentSummary; item?: never } | { item: FolderItem; thread?: never }
const folder = computed(() => props.project.folders.find(item => item.path === props.path))
const items = computed(() => folderItems(props.project, props.path))
const allThreads = computed(() => threadDocuments(props.project))
// A thread removed on disk drops out of the view until the layout is saved again.
const shown = computed(() => (folder.value?.threads ?? []).flatMap(id => allThreads.value.filter(thread => thread.id === id)))
const available = computed(() => allThreads.value.filter(thread => !shown.value.includes(thread)).map(thread => ({ label: thread.title, value: thread.id })))
const axis = computed<ThreadAxis>(() => folder.value?.threadAxis ?? 'rows')
const rows = computed<Head[]>(() => axis.value === 'rows' ? shown.value.map(thread => ({ thread })) : items.value.map(item => ({ item })))
const columns = computed<Head[]>(() => axis.value === 'rows' ? items.value.map(item => ({ item })) : shown.value.map(thread => ({ thread })))
const keyOf = (head: Head) => head.thread ? head.thread.id : head.item.key
const cell = (row: Head, col: Head) => ({ thread: (row.thread ?? col.thread)!, item: (row.item ?? col.item)! })
const onThread = (doc: DocumentSummary, thread: DocumentSummary) => doc.threads.includes(thread.id)
const members = (item: FolderSummary, thread: DocumentSummary) => descendantDocuments(props.project, item.path).filter(doc => onThread(doc, thread))
const picker = ref<{ folder: FolderSummary; thread: DocumentSummary } | null>(null)
const pickerOpen = computed({ get: () => !!picker.value, set: (open: boolean) => { if (!open) picker.value = null } })
const choices = computed(() => picker.value ? descendantDocuments(props.project, picker.value.folder.path).filter(doc => doc.kind !== 'thread') : [])
function toggle(doc: DocumentSummary, thread: DocumentSummary) {
  emit('assign', doc, onThread(doc, thread) ? doc.threads.filter(id => id !== thread.id) : [...doc.threads, thread.id])
}
function addThread(id: unknown) {
  if (typeof id === 'string' && id) emit('layout', { threads: [...(folder.value?.threads ?? []), id] })
}
const removeThread = (id: string) => emit('layout', { threads: (folder.value?.threads ?? []).filter(thread => thread !== id) })
const swap = () => emit('layout', { threadAxis: axis.value === 'rows' ? 'columns' : 'rows' })
</script>

<template>
  <div class="space-y-4 min-w-0">
    <div class="flex flex-wrap items-center gap-2">
      <p class="text-sm text-muted mr-auto">Threads are documents in the Threads folder. Add one here, then mark where it runs through {{ folder?.name || 'this folder' }}.</p>
      <USelect :model-value="''" :items="available" placeholder="Add thread" aria-label="Add thread" :disabled="!available.length" class="w-48" @update:model-value="addThread" />
      <UButton color="neutral" variant="outline" icon="i-lucide-arrow-left-right" :aria-label="axis === 'rows' ? 'Show threads as columns' : 'Show threads as rows'" @click="swap">{{ axis === 'rows' ? 'Threads as columns' : 'Threads as rows' }}</UButton>
      <UButton icon="i-lucide-plus" variant="soft" @click="emit('createDocument', 'Threads')">New thread</UButton>
    </div>
    <p v-if="!allThreads.length" class="text-muted py-8">No threads yet. Create a document in the Threads folder to start one.</p>
    <p v-else-if="!shown.length" class="text-muted py-8">Add a thread to see where it runs through this folder.</p>
    <div v-else class="overflow-auto rounded-lg border border-default max-h-[65dvh]">
      <table class="border-collapse text-sm" aria-label="Threads">
        <thead>
          <tr>
            <th class="sticky top-0 left-0 z-20 bg-default border-b border-r border-default min-w-44 p-2"><span class="sr-only">{{ axis === 'rows' ? 'Thread' : 'Item' }}</span></th>
            <th v-for="col in columns" :key="keyOf(col)" scope="col" class="sticky top-0 z-10 bg-default border-b border-r border-default min-w-44 p-2 align-top text-left font-normal">
              <CollectionCard v-if="col.item" :item="col.item" compact @open="emit('open', col.item)" />
              <CollectionCard v-else :item="{ key: col.thread.id, title: col.thread.title, document: col.thread }" compact @open="emit('open', { key: col.thread.id, title: col.thread.title, document: col.thread })">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${col.thread.title} from this view`" @click="removeThread(col.thread.id)">Remove</UButton>
              </CollectionCard>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="keyOf(row)">
            <th scope="row" class="sticky left-0 z-10 bg-default border-b border-r border-default min-w-44 p-2 align-top text-left font-normal">
              <CollectionCard v-if="row.item" :item="row.item" compact @open="emit('open', row.item)" />
              <CollectionCard v-else :item="{ key: row.thread.id, title: row.thread.title, document: row.thread }" compact @open="emit('open', { key: row.thread.id, title: row.thread.title, document: row.thread })">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${row.thread.title} from this view`" @click="removeThread(row.thread.id)">Remove</UButton>
              </CollectionCard>
            </th>
            <td v-for="col in columns" :key="keyOf(col)" class="relative border-b border-r border-default p-3 min-w-48" :class="axis === 'rows' ? 'align-middle' : 'align-top'">
              <div class="absolute bg-primary/40" :class="axis === 'rows' ? 'inset-x-0 top-1/2 h-1 -translate-y-1/2' : 'inset-y-0 left-1/2 w-1 -translate-x-1/2'" aria-hidden="true" />
              <template v-for="{ thread, item } in [cell(row, col)]" :key="thread.id">
                <div v-if="item.folder" class="relative space-y-3">
                  <CollectionCard v-for="doc in members(item.folder, thread)" :key="doc.id" :item="{ key: doc.id, title: doc.title, document: doc }" @open="emit('open', { key: doc.id, title: doc.title, document: doc })">
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${doc.title} from ${thread.title}`" @click="toggle(doc, thread)">Remove</UButton>
                  </CollectionCard>
                  <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-plus" class="mx-auto flex bg-default" :aria-label="`Choose documents in ${item.folder.name} for ${thread.title}`" @click="picker = { folder: item.folder, thread }">{{ members(item.folder, thread).length ? 'Change' : 'Choose' }}</UButton>
                </div>
                <div v-else-if="item.document.kind === 'thread'" class="relative" />
                <CollectionCard v-else-if="onThread(item.document, thread)" :item="item" class="relative" @open="emit('open', item)">
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="mt-2" :aria-label="`Remove ${item.document.title} from ${thread.title}`" @click="toggle(item.document, thread)">Remove</UButton>
                </CollectionCard>
                <UButton v-else size="xs" color="neutral" variant="outline" icon="i-lucide-plus" class="relative mx-auto flex bg-default" :aria-label="`Add ${item.document.title} to ${thread.title}`" :title="`Add ${item.document.title} to ${thread.title}`" @click="toggle(item.document, thread)" />
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <UModal v-model:open="pickerOpen" :title="picker ? `${picker.thread.title} through ${picker.folder.name}` : 'Choose documents'" description="Tick the documents that belong to this thread.">
      <template #body>
        <div v-if="picker" class="space-y-2">
          <UCheckbox v-for="doc in choices" :key="doc.id" :model-value="onThread(doc, picker.thread)" :label="doc.title" @update:model-value="toggle(doc, picker.thread)" />
          <p v-if="!choices.length" class="text-sm text-muted">This folder has no documents.</p>
        </div>
      </template>
    </UModal>
  </div>
</template>
