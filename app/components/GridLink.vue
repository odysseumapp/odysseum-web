<script setup lang="ts">
import type { DocumentSummary } from '~/models'
import { linked } from '~/services/FolderStructure'
/** Where a row meets a column: a mark when the two are linked, with an optional note that both ends share. */
const props = defineProps<{ doc: DocumentSummary; col: DocumentSummary; name: string }>()
const emit = defineEmits<{ toggle: []; note: [note: string] }>()
const note = computed(() => props.doc.linkNotes?.[props.col.id] ?? props.col.linkNotes?.[props.doc.id] ?? '')
// Enter or leaving the field saves, Escape discards.
const editing = ref(false)
const draft = ref('')
function edit() { draft.value = note.value; editing.value = true }
function finish(keep: boolean) {
  if (!editing.value) return
  editing.value = false
  if (keep && draft.value.trim() !== note.value) emit('note', draft.value.trim())
}
</script>

<template>
  <div v-if="linked(doc, col)" class="group relative mx-auto flex flex-col items-center gap-1 w-fit max-w-full">
    <div class="flex items-center rounded-md border border-primary bg-default">
      <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-circle-check" :aria-label="`Note on ${name} and ${col.title}`" :title="note ? 'Edit note' : 'Add a note'" @click="edit" />
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="hidden group-hover:flex group-focus-within:flex" :aria-label="`Unlink ${name} from ${col.title}`" :title="`Unlink ${name} from ${col.title}`" @click="emit('toggle')" />
    </div>
    <UTextarea
      v-if="editing" v-model="draft" autofocus autoresize :rows="2" :maxrows="8" :maxlength="2000" size="sm" class="w-44"
      :aria-label="`Note on ${name} and ${col.title}`" placeholder="What connects these?"
      @blur="finish(true)" @keydown.enter.exact.prevent="finish(true)" @keydown.esc.prevent.stop="finish(false)"
    />
    <button
      v-else-if="note" type="button" class="w-44 rounded bg-default px-1 text-left text-xs text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-primary"
      :aria-label="`Edit note on ${name} and ${col.title}`" @click="edit"
    >
      <span class="line-clamp-3 whitespace-pre-line break-words">{{ note }}</span>
    </button>
  </div>
  <UButton v-else size="xs" color="neutral" variant="outline" icon="i-lucide-plus" class="relative mx-auto flex bg-default" :aria-label="`Link ${name} to ${col.title}`" :title="`Link ${name} to ${col.title}`" @click="emit('toggle')" />
</template>
