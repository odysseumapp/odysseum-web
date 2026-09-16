import type { DocumentSummary, MetadataFields } from '~/models'
import { renameInOp } from '~/storage/IMirrorStore'

interface DetailsDraft { fields: MetadataFields; base: MetadataFields; dirty: boolean }
export const metadataOf = (doc: DocumentSummary): MetadataFields => ({
  title: doc.title, synopsis: doc.synopsis, notes: doc.notes, status: doc.status, wordGoal: doc.wordGoal,
  characters: [...(doc.characters ?? [])], locations: [...(doc.locations ?? [])], arcPositions: { ...(doc.arcPositions ?? {}) },
})
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export function useDocumentDetails() {
  const workspace = useWorkspace()
  const { active, selectedId, project, rejectedDetails } = workspace
  const drafts = reactive(new Map<string, DetailsDraft>())
  const details = computed(() => drafts.get(selectedId.value))
  const saving = ref(false)
  const storageKey = (id: string) => `odysseum:${project.value?.id}:details:${id}`

  function persist(id: string, draft: DetailsDraft) {
    draft.dirty = JSON.stringify(draft.fields) !== JSON.stringify(draft.base)
    try { localStorage.setItem(storageKey(id), JSON.stringify(draft)) }
    catch { workspace.error.value = 'Browser storage is unavailable. Save your document details before closing this tab.' }
  }
  // A locally created project receives its permanent ID during sync.
  watch(() => project.value?.id, () => { for (const [id, draft] of drafts) persist(id, draft) })
  watch(workspace.documentRenames, renames => {
    for (const [from, to] of renames) {
      const moved = drafts.get(from)
      if (moved) { drafts.delete(from); drafts.set(to, moved) }
      for (const [id, draft] of drafts) {
        const op = renameInOp({ type: 'metadata', id, fields: draft.fields, base: draft.base }, from, to)
        if (op.type === 'metadata') { draft.fields = op.fields; draft.base = op.base; persist(id, draft) }
      }
    }
  }, { flush: 'sync' })
  watch(() => active.value?.document, doc => {
    if (!doc) return
    let draft = drafts.get(doc.id)
    if (!draft) {
      try {
        const stored = localStorage.getItem(storageKey(doc.id))
        if (stored) {
          draft = JSON.parse(stored) as DetailsDraft
          draft.fields.locations ??= []; draft.base.locations ??= []
          draft.fields.arcPositions ??= {}; draft.base.arcPositions ??= {}
        }
      } catch { /* Use the document when a saved draft cannot be read. */ }
    }
    if (!draft?.dirty) draft = { fields: metadataOf(doc), base: metadataOf(doc), dirty: false }
    drafts.set(doc.id, draft)
  }, { immediate: true })
  watch(rejectedDetails, rejected => {
    for (const [id, fields] of rejected) {
      const doc = project.value?.documents.find(item => item.id === id)
      const draft = { fields: clone(fields), base: doc ? metadataOf(doc) : clone(fields), dirty: true }
      drafts.set(id, draft)
      persist(id, draft)
      rejected.delete(id)
    }
  })
  function edit() { if (details.value) persist(selectedId.value, details.value) }
  function reset() {
    if (!active.value || !details.value) return
    details.value.fields = metadataOf(active.value.document)
    details.value.base = metadataOf(active.value.document)
    edit()
  }
  async function save() {
    const draft = details.value
    if (!draft || saving.value) return
    const id = selectedId.value
    const captured = clone(draft.fields)
    saving.value = true
    try {
      await workspace.saveDetails(id, captured, clone(draft.base))
      draft.base = captured
      persist(id, draft)
    } catch (ex) { workspace.showError(ex) }
    finally { saving.value = false }
  }
  return { details, saving, edit, reset, save }
}
