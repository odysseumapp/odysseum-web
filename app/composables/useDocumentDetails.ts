import { detailsOf, type DocumentDetails } from '~/models'

interface DetailsDraft { fields: DocumentDetails; base: DocumentDetails; dirty: boolean }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export function useDocumentDetails() {
  const workspace = useWorkspace()
  const { active, selectedId, projectId, rejectedDetails } = workspace
  const drafts = reactive(new Map<string, DetailsDraft>())
  const details = computed(() => drafts.get(selectedId.value))
  const saving = ref(false)
  const storageKey = (id: string) => `odysseum:${projectId.value}:details:${id}`

  function persist(id: string, draft: DetailsDraft) {
    draft.dirty = JSON.stringify(draft.fields) !== JSON.stringify(draft.base)
    try { localStorage.setItem(storageKey(id), JSON.stringify(draft)) }
    catch { workspace.error.value = 'Browser storage is unavailable. Save your document details before closing this tab.' }
  }
  watch(projectId, () => { for (const [id, draft] of drafts) persist(id, draft) })
  watch(workspace.idRenames, renames => {
    for (const [from, to] of renames) {
      const moved = drafts.get(from)
      if (moved) { drafts.delete(from); drafts.set(to, moved); persist(to, moved) }
    }
  }, { flush: 'sync' })
  watch(() => active.value?.document, doc => {
    if (!doc) return
    let draft = drafts.get(doc.id)
    if (!draft) {
      try {
        const stored = localStorage.getItem(storageKey(doc.id))
        if (stored) draft = JSON.parse(stored) as DetailsDraft
      } catch {  }
    }
    if (!draft?.dirty) draft = { fields: detailsOf(doc), base: detailsOf(doc), dirty: false }
    drafts.set(doc.id, draft)
  }, { immediate: true })
  watch(rejectedDetails, rejected => {
    for (const [id, fields] of rejected) {
      const doc = workspace.project.value?.documents.find(item => item.id === id)
      const draft = { fields: clone(fields), base: doc ? detailsOf(doc) : clone(fields), dirty: true }
      drafts.set(id, draft)
      persist(id, draft)
      rejected.delete(id)
    }
  })
  function edit() { if (details.value) persist(selectedId.value, details.value) }
  function reset() {
    if (!active.value || !details.value) return
    details.value.fields = detailsOf(active.value.document)
    details.value.base = detailsOf(active.value.document)
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
