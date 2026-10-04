import type { IOdysseumApi } from '../api/IOdysseumApi'
import type { IMirrorRepository, PendingEdit } from '../storage'
import type { ILiveUpdates } from '../sync/ILiveUpdates'
import type { ILocalChanges } from '../sync/ILocalChanges'
import type { ISyncEngine, ISyncListener } from '../sync/ISyncEngine'
import { LocalChanges } from '../sync/LocalChanges'
import { MutationQueue } from '../sync/MutationQueue'
import { publishView } from '../sync/ProjectView'
import type { SyncContext } from '../sync/SyncContext'
import { SyncEngine } from '../sync/SyncEngine'
import { HistoryCache } from './HistoryCache'

export class ProjectSession {
  readonly engine: ISyncEngine
  readonly changes: ILocalChanges
  readonly history: HistoryCache
  private readonly context: SyncContext

  constructor(api: IOdysseumApi, mirror: IMirrorRepository, live: ILiveUpdates, projectId: string, listener: ISyncListener) {
    this.context = { api, mirror, projectId, listener, mutations: new MutationQueue(), ids: new Map() }
    this.engine = new SyncEngine(this.context, live)
    this.changes = new LocalChanges(this.context, () => this.engine.syncSoon())
    this.history = new HistoryCache(api, mirror)
  }

  get projectId() { return this.context.projectId }

  async hydrate(): Promise<boolean> {
    const { mirror, listener } = this.context
    const view = await publishView(this.context)
    if (!view) return false
    const summaries = new Map(view.documents.map(doc => [doc.id, doc]))
    const pendings = new Map<string, PendingEdit>((await mirror.listPending(this.projectId)).map(edit => [edit.id, edit]))
    for (const doc of await mirror.listDocuments(this.projectId))
      listener.onDocument({ ...doc, document: summaries.get(doc.id) ?? doc.document }, pendings.get(doc.id))
    return true
  }

  start() { this.engine.start() }

  async close() {
    await this.engine.flush()
    this.engine.stop()
  }
}
