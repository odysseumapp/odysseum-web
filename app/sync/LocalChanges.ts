import type { DocumentDetails, DocumentSummary, ProjectSettings, ViewSettings } from '../models'
import { fileName } from '../services/FileNames'
import { findFolder, linkBetween } from '../services/FolderStructure'
import { newLocalId, type LocalOp, type PendingOp } from '../storage'
import type { ILocalChanges } from './ILocalChanges'
import { localDocument, publishView } from './ProjectView'
import { resolveId, resolveOp, type SyncContext } from './SyncContext'

const badName = (name: string) => !name.trim() || name.includes('/') || name.startsWith('.') || /[\\:*?"<>|]/.test(name) || /[. ]$/.test(name)

export class LocalChanges implements ILocalChanges {
  constructor(private readonly context: SyncContext, private readonly requestSync: () => void) {}

  createDocument(folderId: string, title: string, text = ''): Promise<DocumentSummary> {
    return this.context.mutations.run(async () => {
      const { mirror, listener, projectId } = this.context
      const view = await publishView(this.context)
      const op = resolveOp(this.context, { type: 'createDocument' as const, localId: newLocalId(), folderId, title: title.trim(), text })
      if (!op.title) throw new Error('Enter a title.')
      if (view && !findFolder(view, op.folderId)) throw new Error('The folder no longer exists.')
      const document = localDocument(view, op, `${fileName(op.title)}.md`)
      const mirrored = { projectId, id: op.localId, document, text, textEtag: '' }
      await mirror.putDocuments([mirrored])
      await this.record(op)
      listener.onDocument(mirrored, undefined)
      return document
    })
  }

  updateDetails(documentId: string, fields: DocumentDetails, base: DocumentDetails) {
    return this.context.mutations.run(async () => {
      const op = resolveOp(this.context, { type: 'details' as const, documentId, fields, base })
      const existing = await this.find(item => item.type === 'details' && item.documentId === op.documentId)
      const original = existing?.op.type === 'details' ? existing.op.base : op.base
      await this.record({ ...op, base: original }, existing)
    })
  }

  renameDocument(documentId: string, name: string) {
    return this.context.mutations.run(async () => {
      const clean = name.trim().replace(/\.md$/i, '')
      if (badName(clean)) throw new Error('Use a valid file name.')
      const op = resolveOp(this.context, { type: 'rename' as const, documentId, name: clean })
      await this.record(op, await this.find(item => item.type === 'rename' && item.documentId === op.documentId))
    })
  }

  move(itemId: string, targetFolderId: string, index: number) {
    return this.context.mutations.run(async () => {
      const view = await publishView(this.context)
      itemId = resolveId(this.context, itemId)
      targetFolderId = resolveId(this.context, targetFolderId)
      if (!view || !findFolder(view, targetFolderId)) throw new Error('The folder no longer exists.')
      const folder = findFolder(view, itemId)
      if (folder) {
        for (let at = findFolder(view, targetFolderId); at; at = findFolder(view, at.parentFolderId))
          if (at.id === itemId) throw new Error('A folder cannot move into itself.')
      }
      const op: LocalOp = { type: 'move', itemType: folder ? 'folder' : 'document', itemId, targetFolderId, index }
      // A later move of the same item replaces the earlier one. It goes to the end of the queue, because its target
      // folder may be one that a later op makes.
      const earlier = await this.find(item => item.type === 'move' && item.itemId === itemId)
      if (earlier?.seq !== undefined) await this.context.mirror.deleteOp(earlier.seq)
      await this.record(op)
    })
  }

  createFolder(parentFolderId: string, name: string) {
    return this.context.mutations.run(async () => {
      const view = await publishView(this.context)
      const clean = name.trim()
      if (badName(clean)) throw new Error('Use a valid folder name.')
      const parent = view && findFolder(view, resolveId(this.context, parentFolderId))
      if (!parent) throw new Error('The folder no longer exists.')
      if (parent.childIds.some(id => findFolder(view, id)?.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('That folder already exists.')
      const op: LocalOp = { type: 'createFolder', localId: newLocalId(), parentFolderId: parent.id, name: clean }
      await this.record(op)
      return op.localId
    })
  }

  deleteFolder(folderId: string) {
    return this.context.mutations.run(async () => {
      const view = await publishView(this.context)
      const folder = view && findFolder(view, resolveId(this.context, folderId))
      if (!folder) return
      if (folder.childIds.length) throw new Error('Only empty folders can be removed.')
      await this.record({ type: 'deleteFolder', folderId: folder.id })
    })
  }

  updateLayout(folderId: string, change: { pinnedView?: string | null; views?: Record<string, ViewSettings | null> }) {
    return this.context.mutations.run(async () => {
      folderId = resolveId(this.context, folderId)
      const existing = await this.find(item => item.type === 'layout' && item.folderId === folderId)
      const before = existing?.op.type === 'layout' ? existing.op : undefined
      const op: LocalOp = resolveOp(this.context, {
        type: 'layout', folderId,
        ...(change.pinnedView !== undefined ? { pinnedView: change.pinnedView } : before?.pinnedView !== undefined ? { pinnedView: before.pinnedView } : {}),
        ...(change.views || before?.views ? { views: { ...before?.views, ...change.views } } : {}),
      })
      await this.record(op, existing)
    })
  }

  updateSettings(settings: ProjectSettings) {
    return this.context.mutations.run(async () => {
      const creating = await this.find(op => op.type === 'createProject')
      if (creating?.op.type === 'createProject') {
        await this.record({ ...creating.op, title: settings.title, settings }, creating)
        return
      }
      await this.record({ type: 'settings', settings }, await this.find(op => op.type === 'settings'))
    })
  }

  createLink(firstDocumentId: string, secondDocumentId: string, note = '') {
    return this.context.mutations.run(async () => {
      const view = await publishView(this.context)
      const op = resolveOp(this.context, { type: 'createLink' as const, localId: newLocalId(), firstDocumentId, secondDocumentId, note: note.trim() })
      if (op.firstDocumentId === op.secondDocumentId) throw new Error('A document cannot be linked to itself.')
      if (view && linkBetween(view, op.firstDocumentId, op.secondDocumentId)) return
      await this.record(op)
    })
  }

  deleteLink(linkId: string) {
    return this.context.mutations.run(async () => {
      await this.record({ type: 'deleteLink', linkId: resolveId(this.context, linkId) })
    })
  }

  setLinkNote(linkId: string, note: string) {
    return this.context.mutations.run(async () => {
      linkId = resolveId(this.context, linkId)
      await this.record({ type: 'linkNote', linkId, note: note.trim() }, await this.find(op => op.type === 'linkNote' && op.linkId === linkId))
    })
  }

  private async find(match: (op: LocalOp) => boolean) {
    return (await this.context.mirror.listOps(this.context.projectId)).find(pending => pending.seq !== this.context.replaying && match(pending.op))
  }

  private async record(op: LocalOp, replace?: PendingOp) {
    const pending: PendingOp = { projectId: this.context.projectId, op, updated: new Date().toISOString() }
    if (replace?.seq !== undefined) pending.seq = replace.seq
    await this.context.mirror.putOp(pending)
    await publishView(this.context)
    this.requestSync()
  }
}
