import { ApiError, isETagMismatch, isNotFound, isOffline } from '../api/IApiClient'
import { detailsOf, type DocumentDetails, type Folder } from '../models'
import { folderPath } from '../services/FolderStructure'
import type { LocalOp, PendingEdit, PendingOp } from '../storage'
import { publishView, overlay } from './ProjectView'
import { advanceDocument, changeProject, replaceIds, upsert, type SyncContext } from './SyncContext'

const same = (a: DocumentDetails, b: DocumentDetails) => JSON.stringify(detailsOf(a)) === JSON.stringify(detailsOf(b))

/** Sends the queued changes in order. Each write sends the ETag the mirror holds for the item. When the item changed on
 *  the server (412), the replayer reads it again and tries once more; other refusals drop the change with a message. */
export class OperationReplayer {
  constructor(private readonly context: SyncContext) {}

  async replay(): Promise<number> {
    let replayed = 0
    while (true) {
      const pending = await this.context.mutations.run(async () => {
        const [head] = await this.context.mirror.listOps(this.context.projectId)
        this.context.replaying = head?.seq
        return head
      })
      if (!pending) break
      try {
        await this.apply(pending.op)
        await this.context.mirror.deleteOp(pending.seq!)
        replayed++
      } catch (ex) {
        if (isOffline(ex)) throw ex
        await this.giveUp(pending, ex)
      } finally { this.context.replaying = undefined }
    }
    return replayed
  }

  /** Runs the write; on 412 reads the item again and runs it once more with the new ETag. */
  private async retrying<T>(write: () => Promise<T>, refresh: () => Promise<unknown>): Promise<T> {
    try { return await write() }
    catch (ex) {
      if (!isETagMismatch(ex)) throw ex
      await refresh()
      return write()
    }
  }

  private async mirrored() {
    const mirrored = await this.context.mirror.getProject(this.context.projectId)
    if (!mirrored) throw new ApiError(404, 'The project is not on this device any more.')
    return mirrored
  }
  private async folder(id: string) {
    const folder = (await this.mirrored()).folders.find(item => item.id === id)
    if (!folder) throw new ApiError(404, 'The folder no longer exists.')
    return folder
  }
  private async storeFolders(...folders: Folder[]) { await changeProject(this.context, project => { for (const folder of folders) upsert(project.folders, folder) }) }
  private async refreshFolder(id: string) { await this.storeFolders(await this.context.api.getFolder(id)) }
  private async refreshDocument(id: string) {
    const before = await this.context.mirror.getDocument(this.context.projectId, id)
    const fresh = await this.context.api.getDocument(id)
    // The text may have changed too, so the stored text keeps its old ETag; the next pull reads it again if needed.
    if (before) await this.context.mirror.putDocuments([{ ...before, document: fresh }])
    return fresh
  }
  private async etagOf(documentId: string) {
    const doc = await this.context.mirror.getDocument(this.context.projectId, documentId)
    if (!doc) throw new ApiError(404, 'The document is not on this device any more.')
    return doc
  }

  private async apply(op: LocalOp) {
    const { api, mirror } = this.context
    switch (op.type) {
      case 'createProject': return this.createProject(op)
      case 'settings': {
        const project = await this.retrying(async () => api.updateProjectSettings(this.context.projectId, op.settings, (await this.mirrored()).project.etag),
          async () => { const fresh = await api.getProject(this.context.projectId); await changeProject(this.context, p => { p.project = fresh }) })
        await changeProject(this.context, p => { p.project = project })
        return
      }
      case 'createFolder': {
        const created = await api.createFolder(op.parentFolderId, op.name)
        await replaceIds(this.context, { [op.localId]: created.id })
        await this.storeFolders(created, await api.getFolder(created.parentFolderId!))
        return
      }
      case 'deleteFolder': {
        let parentId: string | null = null
        try {
          await this.retrying(async () => { const folder = await this.folder(op.folderId); parentId = folder.parentFolderId; await api.deleteFolder(folder.id, folder.etag) },
            () => this.refreshFolder(op.folderId))
        } catch (ex) { if (!isNotFound(ex)) throw ex }
        await changeProject(this.context, p => { p.folders = p.folders.filter(folder => folder.id !== op.folderId) })
        if (parentId) await this.refreshFolder(parentId)
        return
      }
      case 'layout': {
        const folder = await this.retrying(async () => {
          const current = await this.folder(op.folderId)
          const pinnedView = op.pinnedView !== undefined ? op.pinnedView : current.pinnedView
          return api.updateFolderLayout(current.id, { pinnedView, views: op.views }, current.etag)
        }, () => this.refreshFolder(op.folderId))
        await this.storeFolders(folder)
        return
      }
      case 'createDocument': {
        const created = await api.createDocument(op.folderId, op.title, op.text)
        await this.context.mutations.run(async () => {
          await replaceIds(this.context, { [op.localId]: created.id })
          const { projectId } = this.context
          const doc = { projectId, id: created.id, document: created, text: op.text, textEtag: created.etag }
          await mirror.putDocuments([doc])
          const edit = await mirror.getPending(projectId, created.id)
          if (edit && edit.text === op.text) await mirror.deletePending(projectId, created.id)
          else if (edit) { edit.baseEtag = created.etag; edit.baseText = op.text; await mirror.putPending(edit) }
          this.context.listener.onDocument(doc, edit && edit.text !== op.text ? edit : undefined)
        })
        await this.refreshFolder(created.folderId)
        return
      }
      case 'details': {
        const before = await this.etagOf(op.documentId)
        let current = before.document
        if (!same(current, op.base) && same(current, op.fields)) return
        let saved
        try { saved = await api.updateDocumentDetails(op.documentId, op.fields, current.etag) }
        catch (ex) {
          if (!isETagMismatch(ex)) throw ex
          current = await this.refreshDocument(op.documentId)
          if (same(current, op.fields)) return
          if (!same(current, op.base)) {
            this.context.listener.onDetailsRejected(op.documentId, op.fields, `Details for "${current.title}" changed elsewhere. Your version is back in the inspector to review.`)
            return
          }
          saved = await api.updateDocumentDetails(op.documentId, op.fields, current.etag)
        }
        await advanceDocument(this.context, await mirror.getDocument(this.context.projectId, op.documentId), saved)
        return
      }
      case 'rename': {
        const saved = await this.retrying(async () => api.renameDocument(op.documentId, op.name, (await this.etagOf(op.documentId)).document.etag),
          () => this.refreshDocument(op.documentId))
        await advanceDocument(this.context, await mirror.getDocument(this.context.projectId, op.documentId), saved)
        return
      }
      case 'move': {
        if (op.itemType === 'folder') {
          const moved = await this.retrying(async () => api.moveFolder(op.itemId, op.targetFolderId, op.index, (await this.folder(op.itemId)).etag),
            () => this.refreshFolder(op.itemId))
          await this.storeFolders(moved.folder, moved.oldParentFolder, moved.newParentFolder)
        } else {
          const moved = await this.retrying(async () => api.moveDocument(op.itemId, op.targetFolderId, op.index, (await this.etagOf(op.itemId)).document.etag),
            () => this.refreshDocument(op.itemId))
          await this.storeFolders(moved.oldFolder, moved.newFolder)
          await advanceDocument(this.context, await mirror.getDocument(this.context.projectId, op.itemId), moved.document)
        }
        return
      }
      case 'createLink': {
        const link = await api.createLink(op.firstDocumentId, op.secondDocumentId, op.note)
        await replaceIds(this.context, { [op.localId]: link.id })
        await changeProject(this.context, p => upsert(p.links, link))
        return
      }
      case 'deleteLink': {
        try {
          await this.retrying(async () => {
            const link = (await this.mirrored()).links.find(item => item.id === op.linkId)
            if (link) await api.deleteLink(link.id, link.etag)
          }, async () => { const fresh = await api.getLink(op.linkId); await changeProject(this.context, p => upsert(p.links, fresh)) })
        } catch (ex) { if (!isNotFound(ex)) throw ex }
        await changeProject(this.context, p => { p.links = p.links.filter(link => link.id !== op.linkId) })
        return
      }
      case 'linkNote': {
        const link = await this.retrying(async () => {
          const current = (await this.mirrored()).links.find(item => item.id === op.linkId)
          if (!current) throw new ApiError(404, 'The link no longer exists.')
          return api.updateLinkNote(current.id, op.note, current.etag)
        }, async () => { const fresh = await api.getLink(op.linkId); await changeProject(this.context, p => upsert(p.links, fresh)) })
        await changeProject(this.context, p => upsert(p.links, link))
        return
      }
    }
  }

  /** Makes the project on the server and gives the folders made on this device the IDs of the server's folders with the same path. */
  private async createProject(op: Extract<LocalOp, { type: 'createProject' }>) {
    const { api, mirror } = this.context
    const local = await this.mirrored()
    const localProjectId = this.context.projectId
    const created = await api.createProject(op.title, op.settings.wordGoal, op.templateName).catch(ex => {
      if (op.templateName && isNotFound(ex)) return api.createProject(op.title, op.settings.wordGoal)
      throw ex
    })
    let project = created
    if (project.title !== op.settings.title || project.defaultSceneWordGoal !== op.settings.defaultSceneWordGoal)
      project = await api.updateProjectSettings(created.id, op.settings, created.etag)
    const [folders, links] = await Promise.all([api.listFolders(created.id), api.listLinks(created.id)])
    const localView = overlay(local, [], [])
    const serverView = { project, folders, documents: [], links }
    const byPath = new Map(folders.map(folder => [folderPath(serverView, folder.id), folder.id]))
    const ids: Record<string, string> = { [localProjectId]: created.id, [op.rootFolderId]: created.rootFolderId }
    for (const folder of local.folders) {
      const match = byPath.get(folderPath(localView, folder.id))
      if (match) ids[folder.id] = match
    }
    await replaceIds(this.context, ids)
    await mirror.putProject({ projectId: created.id, project, folders, links, syncedAt: new Date().toISOString() })
    const known = await mirror.listProjects()
    await mirror.putProjects([...known.filter(item => item.id !== localProjectId && item.id !== created.id), project])
  }

  private async giveUp(pending: PendingOp, ex: unknown) {
    const { mirror, listener, projectId } = this.context
    await mirror.deleteOp(pending.seq!)
    const message = ex instanceof Error ? ex.message : 'The server refused a change.'
    const op = pending.op
    if (op.type === 'createDocument') {
      const edit = await mirror.getPending(projectId, op.localId)
      const kept: PendingEdit = { projectId, id: op.localId, text: edit?.text ?? op.text, baseEtag: '', updated: new Date().toISOString(), conflict: 'deleted' }
      await mirror.putPending(kept)
      const doc = await mirror.getDocument(projectId, op.localId)
      if (doc) listener.onDocument(doc, kept)
      listener.onProblem(`"${op.title}" could not be made on the server: ${message}`)
    } else if (op.type === 'createProject') {
      listener.onProblem(`The project "${op.title}" could not be made on the server: ${message}`)
    } else {
      listener.onProblem(message)
    }
    await publishView(this.context)
  }
}
