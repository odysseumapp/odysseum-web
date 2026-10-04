import { isNotFound } from '../api/IApiClient'
import type { DocumentSummary, DocumentText, ItemChange } from '../models'
import type { MirroredDocument, PendingEdit } from '../storage'
import { publishView } from './ProjectView'
import { changeProject, upsert, type SyncContext } from './SyncContext'

const TEXT_READS_AT_ONCE = 6

/** Reads the server's state into the mirror: the whole project, or only the items a change message names. */
export class ProjectPuller {
  constructor(private readonly context: SyncContext) {}

  private async creating() {
    return (await this.context.mirror.listOps(this.context.projectId)).some(pending => pending.op.type === 'createProject')
  }

  async pull(): Promise<boolean> {
    const { api, mirror } = this.context
    if (await this.creating()) return false
    const projectId = this.context.projectId
    const [project, folders, documents, links] = await Promise.all([
      api.getProject(projectId), api.listFolders(projectId), api.listDocuments(projectId), api.listLinks(projectId),
    ])
    await mirror.putProject({ projectId, project, folders, links, syncedAt: new Date().toISOString() })
    const mirrored = new Map((await mirror.listDocuments(projectId)).map(doc => [doc.id, doc]))
    await this.storeDocuments(documents, mirrored)
    const present = new Set(documents.map(doc => doc.id))
    for (const [id, existing] of mirrored) if (!present.has(id)) await this.removeDocument(existing)
    await publishView(this.context)
    return true
  }

  /** Reads the items whose ETag differs from the mirror's, and drops the removed ones. */
  async apply(changes: ItemChange[]): Promise<void> {
    const { api, mirror } = this.context
    if (!changes.length || await this.creating()) return
    const projectId = this.context.projectId
    const mirroredProject = await mirror.getProject(projectId)
    if (!mirroredProject) return
    const folders = new Map(mirroredProject.folders.map(folder => [folder.id, folder.etag]))
    const links = new Map(mirroredProject.links.map(link => [link.id, link.etag]))
    const latest = new Map<string, ItemChange>()
    for (const change of changes) latest.set(`${change.type}:${change.id}`, change)
    const documentChanges: ItemChange[] = []
    for (const change of latest.values()) {
      const gone = change.kind === 'removed'
      try {
        switch (change.type) {
          case 'project':
            if (!gone && change.etag !== mirroredProject.project.etag) { const fresh = await api.getProject(projectId); await changeProject(this.context, p => { p.project = fresh }) }
            break
          case 'folder':
            if (gone) await changeProject(this.context, p => { p.folders = p.folders.filter(folder => folder.id !== change.id) })
            else if (change.etag !== folders.get(change.id)) { const fresh = await api.getFolder(change.id); await changeProject(this.context, p => upsert(p.folders, fresh)) }
            break
          case 'link':
            if (gone) await changeProject(this.context, p => { p.links = p.links.filter(link => link.id !== change.id) })
            else if (change.etag !== links.get(change.id)) { const fresh = await api.getLink(change.id); await changeProject(this.context, p => upsert(p.links, fresh)) }
            break
          case 'document':
            documentChanges.push(change)
            break
        }
      } catch (ex) {
        if (!isNotFound(ex)) throw ex
        await changeProject(this.context, p => { p.folders = p.folders.filter(item => item.id !== change.id); p.links = p.links.filter(item => item.id !== change.id) })
      }
    }
    if (documentChanges.length) {
      const mirrored = new Map((await mirror.listDocuments(projectId)).map(doc => [doc.id, doc]))
      const fresh: DocumentSummary[] = []
      for (const change of documentChanges) {
        const existing = mirrored.get(change.id)
        if (change.kind === 'removed') { if (existing) await this.removeDocument(existing); continue }
        if (existing && change.etag === existing.document.etag) {
          // Another tab of this browser already stored it in the shared mirror; only this tab's screen is behind.
          this.context.listener.onDocument(existing, await mirror.getPending(projectId, existing.id))
          continue
        }
        try { fresh.push(await api.getDocument(change.id)) }
        catch (ex) { if (!isNotFound(ex)) throw ex; if (existing) await this.removeDocument(existing) }
      }
      await this.storeDocuments(fresh, mirrored)
    }
    await publishView(this.context)
  }

  /** Stores the summaries, reads the text of each document whose text may have changed, and settles pending edits. */
  private async storeDocuments(summaries: DocumentSummary[], mirrored: Map<string, MirroredDocument>) {
    const { api, mirror, listener } = this.context
    const projectId = this.context.projectId
    const pendings = new Map((await mirror.listPending(projectId)).map(edit => [edit.id, edit]))
    const stale = summaries.filter(summary => mirrored.get(summary.id)?.textEtag !== summary.etag)
    const texts = new Map<string, DocumentText>()
    for (let start = 0; start < stale.length; start += TEXT_READS_AT_ONCE) {
      await Promise.all(stale.slice(start, start + TEXT_READS_AT_ONCE).map(async summary => {
        try { texts.set(summary.id, await api.getDocumentText(summary.id)) }
        catch (ex) { if (!isNotFound(ex)) throw ex }
      }))
    }
    const updates: MirroredDocument[] = summaries.map(summary => {
      const existing = mirrored.get(summary.id)
      const text = texts.get(summary.id)
      return text ? { projectId, id: summary.id, document: summary, text: text.text, textEtag: text.etag }
        : { projectId, id: summary.id, document: summary, text: existing?.text ?? '', textEtag: existing?.textEtag ?? '' }
    })
    await mirror.putDocuments(updates)
    for (const doc of updates) {
      const before = mirrored.get(doc.id)
      const pending = pendings.get(doc.id)
      if (pending && !pending.conflict && texts.has(doc.id)) {
        if (pending.text === doc.text) {
          await mirror.deletePending(projectId, doc.id)
          listener.onDocument(doc, undefined)
          continue
        }
        if (pending.baseEtag !== doc.textEtag) {
          // The text on the server is still the one the edit started from: only the details, name or place changed.
          const base = pending.baseText ?? (before && pending.baseEtag === before.textEtag ? before.text : undefined)
          if (base === doc.text) pending.baseEtag = doc.textEtag
          else pending.conflict = { document: doc.document, text: doc.text }
          await mirror.putPending(pending)
        }
      }
      listener.onDocument(doc, pending)
    }
  }

  private async removeDocument(existing: MirroredDocument) {
    const { mirror, listener } = this.context
    const projectId = this.context.projectId
    if (existing.document.etag === '') return
    const pending = await mirror.getPending(projectId, existing.id)
    if (pending) {
      pending.conflict = 'deleted'
      await mirror.putPending(pending)
      listener.onDocument(existing, pending)
    } else if (listener.isOpen(existing.id)) {
      const kept: PendingEdit = { projectId, id: existing.id, text: existing.text, baseEtag: existing.document.etag, updated: new Date().toISOString(), conflict: 'deleted' }
      await mirror.putPending(kept)
      listener.onDocument(existing, kept)
    } else {
      await mirror.deleteDocument(projectId, existing.id)
      listener.onRemoved(existing.id)
    }
  }
}
