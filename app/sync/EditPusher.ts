import { isETagMismatch, isNotFound } from '../api/IApiClient'
import type { MirroredDocument } from '../storage'
import type { SyncContext } from './SyncContext'

/** Sends pending text edits with the ETag they started from. */
export class EditPusher {
  constructor(private readonly context: SyncContext) {}

  async push(): Promise<number> {
    const { mirror } = this.context
    let pushed = 0
    for (const edit of await mirror.listPending(this.context.projectId)) {
      if (edit.conflict || edit.baseEtag === '') continue
      if (await this.send(edit.id, edit.text, edit.baseEtag)) pushed++
    }
    return pushed
  }

  private async send(id: string, text: string, etag: string, rebased = false): Promise<boolean> {
    const { api, mirror, listener } = this.context
    const projectId = this.context.projectId
    try {
      const saved = await api.updateDocumentText(id, text, etag)
      const doc: MirroredDocument = { projectId, id, document: saved, text, textEtag: saved.etag }
      await mirror.putDocuments([doc])
      const latest = await mirror.getPending(projectId, id)
      if (latest && latest.text !== text) {
        latest.baseEtag = saved.etag
        latest.baseText = text
        await mirror.putPending(latest)
        listener.onDocument(doc, latest)
      } else {
        await mirror.deletePending(projectId, id)
        listener.onDocument(doc, undefined)
      }
      return true
    } catch (ex) {
      if (!isETagMismatch(ex) && !isNotFound(ex)) throw ex
      const retry = await this.settle(id, etag, rebased)
      return retry ? this.send(id, retry.text, retry.etag, true) : false
    }
  }

  /** Reads the document after a refused save. Returns what to send again when only the details, name or place changed. */
  private async settle(id: string, baseEtag: string, rebased: boolean): Promise<{ text: string; etag: string } | undefined> {
    const { api, mirror, listener } = this.context
    const projectId = this.context.projectId
    const before = await mirror.getDocument(projectId, id)
    let remote
    try { remote = await Promise.all([api.getDocument(id), api.getDocumentText(id)]) }
    catch (ex) {
      if (!isNotFound(ex)) throw ex
      const latest = await mirror.getPending(projectId, id)
      if (!latest) return
      latest.conflict = 'deleted'
      await mirror.putPending(latest)
      if (before) listener.onDocument(before, latest)
      return
    }
    const [summary, text] = remote
    const doc: MirroredDocument = { projectId, id, document: summary, text: text.text, textEtag: text.etag }
    await mirror.putDocuments([doc])
    const latest = await mirror.getPending(projectId, id)
    if (!latest) return
    if (text.text === latest.text) {
      await mirror.deletePending(projectId, id)
      listener.onDocument(doc, undefined)
      return
    }
    const base = latest.baseText ?? (before && before.textEtag === baseEtag ? before.text : undefined)
    if (!rebased && base === text.text) {
      latest.baseEtag = text.etag
      await mirror.putPending(latest)
      return { text: latest.text, etag: text.etag }
    }
    latest.conflict = { document: summary, text: text.text }
    await mirror.putPending(latest)
    listener.onDocument(doc, latest)
  }
}
