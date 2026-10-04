import type { DocumentSummary, Folder, Link, ProjectSnapshot } from '../models'
import { kindInFolder } from '../services/FolderStructure'
import type { LocalOp, MirroredDocument, MirroredProject, PendingOp } from '../storage'
import type { SyncContext } from './SyncContext'

const clone = <T>(value: T): T => structuredClone(value)
const insertAt = (list: string[], id: string, index: number) => list.splice(Math.max(0, Math.min(index, list.length)), 0, id)

/** The project the UI shows: the server's items with the queued local changes on top. */
export function overlay(server: MirroredProject, ops: PendingOp[], documents: MirroredDocument[]): ProjectSnapshot {
  const view: ProjectSnapshot = {
    project: clone(server.project),
    folders: clone(server.folders),
    documents: documents.map(doc => clone(doc.document)),
    links: clone(server.links),
  }
  const folder = (id: string) => view.folders.find(item => item.id === id)
  const doc = (id: string) => view.documents.find(item => item.id === id)
  const detach = (id: string) => { for (const item of view.folders) item.childIds = item.childIds.filter(child => child !== id) }
  for (const { op } of ops) apply(op)
  return view

  function apply(op: LocalOp) {
    switch (op.type) {
      case 'createProject': case 'settings':
        Object.assign(view.project, op.settings)
        break
      case 'createFolder':
        if (!folder(op.localId)) view.folders.push({ id: op.localId, projectId: view.project.id, name: op.name, parentFolderId: op.parentFolderId, childIds: [],
          ownDocumentId: null, pinnedView: null, views: {}, etag: '' } satisfies Folder)
        if (!folder(op.parentFolderId)?.childIds.includes(op.localId)) folder(op.parentFolderId)?.childIds.push(op.localId)
        break
      case 'deleteFolder':
        view.folders = view.folders.filter(item => item.id !== op.folderId)
        detach(op.folderId)
        break
      case 'layout': {
        const target = folder(op.folderId)
        if (!target) break
        if (op.pinnedView !== undefined) target.pinnedView = op.pinnedView
        for (const [name, settings] of Object.entries(op.views ?? {})) {
          if (settings === null) delete target.views[name]
          else target.views[name] = clone(settings)
        }
        break
      }
      case 'createDocument':
        if (!folder(op.folderId)?.childIds.includes(op.localId)) folder(op.folderId)?.childIds.push(op.localId)
        break
      case 'details':
        Object.assign(doc(op.documentId) ?? {}, op.fields)
        break
      case 'rename': {
        const target = doc(op.documentId)
        if (target) target.name = `${op.name}.md`
        break
      }
      case 'move': {
        const target = folder(op.targetFolderId)
        if (!target) break
        detach(op.itemId)
        insertAt(target.childIds, op.itemId, op.index)
        if (op.itemType === 'folder') { const moved = folder(op.itemId); if (moved) moved.parentFolderId = target.id }
        else { const moved = doc(op.itemId); if (moved) { moved.folderId = target.id; moved.kind = kindInFolder(view, target.id) } }
        break
      }
      case 'createLink':
        if (!view.links.some(link => link.id === op.localId)) view.links.push({ id: op.localId, projectId: view.project.id, firstDocumentId: op.firstDocumentId,
          secondDocumentId: op.secondDocumentId, note: op.note, etag: '' } satisfies Link)
        break
      case 'deleteLink':
        view.links = view.links.filter(link => link.id !== op.linkId)
        break
      case 'linkNote': {
        const link = view.links.find(item => item.id === op.linkId)
        if (link) link.note = op.note
        break
      }
    }
  }
}

/** A document made on this device, until the server answers. */
export function localDocument(view: ProjectSnapshot | undefined, op: Extract<LocalOp, { type: 'createDocument' }>, name: string): DocumentSummary {
  return {
    id: op.localId, projectId: view?.project.id ?? '', folderId: op.folderId, name, kind: view ? kindInFolder(view, op.folderId) : 'scene',
    isFolderDocument: false, title: op.title, synopsis: '', notes: '', status: 'draft', wordGoal: view?.project.defaultSceneWordGoal ?? 0,
    wordCount: 0, lastModified: new Date().toISOString(), etag: '',
  }
}

export async function publishView(context: SyncContext): Promise<ProjectSnapshot | undefined> {
  const mirrored = await context.mirror.getProject(context.projectId)
  if (!mirrored) return undefined
  const [ops, documents] = await Promise.all([context.mirror.listOps(context.projectId), context.mirror.listDocuments(context.projectId)])
  const view = overlay(mirrored, ops, documents)
  context.listener.onProject(view)
  return view
}

export async function countPending(context: SyncContext) {
  const [edits, ops] = await Promise.all([context.mirror.listPending(context.projectId), context.mirror.listOps(context.projectId)])
  return edits.length + ops.length
}
