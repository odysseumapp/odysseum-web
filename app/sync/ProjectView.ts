import { countWords, type DocumentSummary, type Project, type ProjectSettings } from '../models'
import { kindFor } from '../services/FileNames'
import { completeFolders, folderFor } from '../services/FolderStructure'
import type { LocalOp, MirroredDocument, PendingOp } from '../storage'
import type { SyncContext } from './SyncContext'

/** The server's copy with every queued local change applied, in the order it was made: what the writer should see. */
export function overlay(server: Project, ops: PendingOp[], documents: Map<string, MirroredDocument>): Project {
  let settings: ProjectSettings = server.settings
  let folders = completeFolders(server.folders, server.documents, settings.title)
  let list: DocumentSummary[] = server.documents.map(doc => ({ ...doc, links: [...(doc.links ?? [])], linkNotes: { ...(doc.linkNotes ?? {}) } }))
  for (const { op } of ops) {
    switch (op.type) {
      case 'createFolder':
        if (!folders.some(folder => folder.path === op.path)) folders.push(folderFor(op.path))
        break
      case 'removeFolder':
        folders = folders.filter(folder => folder.path !== op.path)
        break
      case 'folderLayout': {
        const folder = folders.find(folder => folder.path === op.path)
        if (folder) Object.assign(folder, op.patch)
        break
      }
      case 'create':
        if (!list.some(doc => doc.id === op.id)) list.push(documents.get(op.id)?.document ?? summaryFor(op, list, settings))
        folders = completeFolders(folders, list, settings.title)
        break
      case 'metadata': {
        const doc = list.find(item => item.id === op.id)
        if (!doc) break
        // Links are undirected: the documents at the other end change with this one, as they will on the server.
        const before = new Set(doc.links)
        const after = new Set(op.fields.links ?? [])
        for (const other of list) {
          if (before.has(other.id) && !after.has(other.id)) other.links = other.links.filter(id => id !== op.id)
          if (after.has(other.id) && !other.links.includes(op.id)) other.links = [...other.links, op.id]
        }
        // A note is shared by both ends of its link and goes when the link does.
        const notes = Object.fromEntries(Object.entries(op.fields.linkNotes ?? doc.linkNotes).filter(([id, note]) => after.has(id) && note.trim()).map(([id, note]) => [id, note.trim()]))
        for (const other of list) {
          if (other.id === op.id || !(op.id in other.linkNotes || other.id in notes)) continue
          const { [op.id]: _, ...rest } = other.linkNotes
          other.linkNotes = other.id in notes ? { ...rest, [op.id]: notes[other.id]! } : rest
        }
        Object.assign(doc, op.fields, { linkNotes: notes })
        break
      }
      case 'move': {
        const doc = list.find(item => item.id === op.id)
        if (doc) { doc.kind = kindFor(op.path); doc.path = op.path; doc.folder = op.path.split('/').slice(0, -1).join('/') }
        folders = completeFolders(folders, list, settings.title)
        break
      }
      case 'order': {
        const position = new Map(op.ids.map((id, index) => [id, index]))
        const known = list.filter(doc => position.has(doc.id)).sort((a, b) => position.get(a.id)! - position.get(b.id)!)
        list = [...known, ...list.filter(doc => !position.has(doc.id))].map((doc, index) => ({ ...doc, order: index }))
        break
      }
      case 'settings':
      case 'createProject':
        settings = op.settings
        break
    }
  }
  return { ...server, settings, documents: list, folders: completeFolders(folders, list, settings.title) }
}

/** The summary a scene created offline shows until the server has it. */
export function summaryFor(op: Extract<LocalOp, { type: 'create' }>, existing: DocumentSummary[], settings: ProjectSettings): DocumentSummary {
  return {
    id: op.id, path: op.path, title: op.title, folder: op.folder, synopsis: '', notes: '', status: 'draft',
    wordGoal: settings.defaultSceneWordGoal, order: existing.length ? Math.max(...existing.map(doc => doc.order)) + 1 : 0,
    wordCount: countWords(op.content), revision: '', lastModified: new Date().toISOString(),
    kind: kindFor(op.path), links: [], linkNotes: {},
  }
}

/** Rebuilds the view from the mirror and hands it to the listener. */
export async function publishView(context: SyncContext): Promise<Project | undefined> {
  const mirrored = await context.mirror.getProject(context.slug)
  if (!mirrored) return undefined
  const [ops, documents] = await Promise.all([context.mirror.listOps(context.slug), context.mirror.listDocuments(context.slug)])
  const view = overlay(mirrored.project, ops, new Map(documents.map(doc => [doc.id, doc])))
  context.listener.onProject(view)
  return view
}

export async function countPending(context: SyncContext) {
  const [edits, ops] = await Promise.all([context.mirror.listPending(context.slug), context.mirror.listOps(context.slug)])
  return edits.length + ops.length
}
