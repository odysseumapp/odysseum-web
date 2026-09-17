import type { DocumentSummary, FolderLayout, MetadataFields, ProjectSettings } from '../models'
import { isFolderDocument, pathFor } from '../services/FileNames'
import type { LocalOp, PendingOp } from '../storage'
import type { ILocalChanges } from './ILocalChanges'
import { publishView, summaryFor } from './ProjectView'
import { resolveOperation, type SyncContext } from './SyncContext'

export class LocalChanges implements ILocalChanges {
  constructor(private readonly context: SyncContext, private readonly requestSync: () => void) {}

  async createDocument(title: string, folder: string, content = ''): Promise<DocumentSummary> {
    return this.context.mutations.run(async () => {
      const { mirror, listener } = this.context
      const slug = this.context.slug
      const view = await publishView(this.context)
      const taken = new Set((view?.documents ?? []).map(doc => doc.path.toLowerCase()))
      const op: Extract<LocalOp, { type: 'create' }> = {
        type: 'create', id: `local-${crypto.randomUUID()}`, title: title.trim(), folder: folder.trim().replace(/^\/+|\/+$/g, ''),
        path: pathFor(title, folder, taken), content,
      }
      const document = summaryFor(op, view?.documents ?? [], view?.settings ?? { title: '', wordGoal: 0, defaultSceneWordGoal: 1000 })
      const mirrored = { slug, id: op.id, document, content }
      await mirror.putDocuments([mirrored])
      await this.record(op)
      listener.onDocument(mirrored, undefined)
      return document
    })
  }

  async updateMetadata(id: string, fields: MetadataFields, base: MetadataFields) {
    return this.context.mutations.run(async () => {
      const resolved = resolveOperation(this.context, { type: 'metadata', id, fields, base }) as Extract<LocalOp, { type: 'metadata' }>
      const existing = await this.find(op => op.type === 'metadata' && op.id === resolved.id)
      // Coalesce waiting edits, but never replace an operation already being sent to the server.
      const original = existing?.op.type === 'metadata' ? existing.op.base : resolved.base
      await this.record({ ...resolved, base: original }, existing)
    })
  }

  async moveDocument(id: string, path: string) {
    await this.context.mutations.run(async () => {
      const op = resolveOperation(this.context, { type: 'move', id, path }) as Extract<LocalOp, { type: 'move' }>
      await this.record(op, await this.find(item => item.type === 'move' && item.id === op.id))
    })
  }

  async reorder(ids: string[]) {
    await this.context.mutations.run(async () => {
      await this.record(resolveOperation(this.context, { type: 'order', ids }), await this.find(op => op.type === 'order'))
    })
  }

  async updateSettings(settings: ProjectSettings) {
    return this.context.mutations.run(async () => {
      const creating = await this.find(op => op.type === 'createProject')
      if (creating && creating.op.type === 'createProject') {
        await this.record({ ...creating.op, title: settings.title, settings }, creating)
        return
      }
      await this.record({ type: 'settings', settings }, await this.find(op => op.type === 'settings'))
    })
  }

  async createFolder(path: string) {
    return this.context.mutations.run(async () => {
      const view = await publishView(this.context)
      if (!path || path.split('/').some(part => !part.trim() || part.startsWith('.') || /[\\:*?"<>|]/.test(part) || /[. ]$/.test(part))) throw new Error('Use a valid folder name.')
      if (view?.folders.some(folder => folder.path.toLocaleLowerCase() === path.toLocaleLowerCase())) throw new Error('That folder already exists.')
      await this.record({ type: 'createFolder', path })
    })
  }

  async removeFolder(path: string) {
    return this.context.mutations.run(async () => {
      const view = await publishView(this.context)
      // The folder's own hidden document goes with it; anything else makes the folder non-empty.
      if (!path || view?.documents.some(doc => (doc.folder === path && !isFolderDocument(doc.path)) || doc.folder.startsWith(path + '/'))
        || view?.folders.some(folder => folder.parent === path)) throw new Error('Only empty folders can be removed.')
      await this.record({ type: 'removeFolder', path })
    })
  }

  async saveFolderLayout(path: string, patch: Partial<FolderLayout>) {
    return this.context.mutations.run(async () => {
      const resolved = resolveOperation(this.context, { type: 'folderLayout', path, patch }) as Extract<LocalOp, { type: 'folderLayout' }>
      // Keep operations in order: a later layout may reference a document created between edits.
      await this.record(resolved)
    })
  }

  private async find(match: (op: LocalOp) => boolean) {
    return (await this.context.mirror.listOps(this.context.slug)).find(pending => pending.seq !== this.context.replaying && match(pending.op))
  }

  private async record(op: LocalOp, replace?: PendingOp) {
    // An auto-increment key must be absent, not undefined, for IndexedDB to assign one.
    const pending: PendingOp = { slug: this.context.slug, op, updated: new Date().toISOString() }
    if (replace?.seq !== undefined) pending.seq = replace.seq
    await this.context.mirror.putOp(pending)
    await publishView(this.context)
    this.requestSync()
  }
}
