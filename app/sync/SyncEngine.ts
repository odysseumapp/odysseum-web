import { isOffline } from '../api/IApiClient'
import type { ItemChange } from '../models'
import { EditPusher } from './EditPusher'
import type { ILiveUpdates } from './ILiveUpdates'
import type { ISyncEngine, SyncStatus } from './ISyncEngine'
import { OperationReplayer } from './OperationReplayer'
import { ProjectPuller } from './ProjectPuller'
import { countPending, publishView } from './ProjectView'
import { resolveId, type SyncContext } from './SyncContext'

/** A full pull while the live connection works, as a safety net. */
const FULL_SYNC_LIVE_MS = 60000
/** A full pull while the live connection is down. */
const FULL_SYNC_MS = 20000
const PUSH_DELAY_MS = 850
const CHANGE_DELAY_MS = 100
const WRITE_DELAY_MS = 150
const MIN_BACKOFF_MS = 2000
const MAX_BACKOFF_MS = 30000

export class SyncEngine implements ISyncEngine {
  private readonly replayer: OperationReplayer
  private readonly puller: ProjectPuller
  private readonly pusher: EditPusher
  private status: SyncStatus = { online: true, syncing: false, pending: 0, lastSync: null, error: '' }
  private timer: ReturnType<typeof setTimeout> | undefined
  private pushTimer: ReturnType<typeof setTimeout> | undefined
  private writes = new Map<string, { text: string; timer: ReturnType<typeof setTimeout> }>()
  private incoming: ItemChange[] = []
  private fullPull = true
  private channel: BroadcastChannel | undefined
  private unsubscribe: (() => void)[] = []
  private passing = false
  private again = false
  private current: Promise<void> = Promise.resolve()
  private backoff = MIN_BACKOFF_MS
  private stopped = true
  private joined = ''

  constructor(private readonly context: SyncContext, private readonly live: ILiveUpdates) {
    this.replayer = new OperationReplayer(context)
    this.puller = new ProjectPuller(context)
    this.pusher = new EditPusher(context)
  }

  get projectId() { return this.context.projectId }

  start() {
    this.stopped = false
    this.join()
    this.unsubscribe = [
      this.live.onChanged(message => { if (message.projectId === this.projectId) this.receive(message.changes) }),
      this.live.onReconnected(() => { this.requestFullPull(); void this.syncNow() }),
    ]
    if ('BroadcastChannel' in globalThis) {
      this.channel = new BroadcastChannel('odysseum-sync')
      this.channel.onmessage = event => { if (event.data?.projectId === this.projectId) void this.syncNow() }
    }
    window.addEventListener('online', this.onOnline)
    document.addEventListener('visibilitychange', this.onVisible)
    void this.syncNow()
  }

  stop() {
    this.stopped = true
    if (this.joined) this.live.closeProject(this.joined)
    this.joined = ''
    for (const off of this.unsubscribe) off()
    this.channel?.close()
    window.removeEventListener('online', this.onOnline)
    document.removeEventListener('visibilitychange', this.onVisible)
    clearTimeout(this.timer)
    clearTimeout(this.pushTimer)
    for (const write of this.writes.values()) clearTimeout(write.timer)
  }

  receive(changes: ItemChange[]) {
    this.incoming.push(...changes)
    this.syncSoon(CHANGE_DELAY_MS)
  }

  requestFullPull() { this.fullPull = true }

  edit(id: string, text: string) {
    id = resolveId(this.context, id)
    const existing = this.writes.get(id)
    if (existing) clearTimeout(existing.timer)
    this.writes.set(id, { text, timer: setTimeout(() => { void this.flushEdit(id) }, WRITE_DELAY_MS) })
  }

  isWriting(id: string) { return this.writes.has(resolveId(this.context, id)) }
  hasUnwritten() { return this.writes.size > 0 }

  async flush() {
    await Promise.all([...this.writes.keys()].map(id => this.flushEdit(id)))
  }

  syncSoon(delay = PUSH_DELAY_MS) {
    clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => { void this.syncNow() }, delay)
  }

  syncNow(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (this.passing) { this.again = true; return this.current }
    this.current = this.pass()
    return this.current
  }

  async useServer(id: string) {
    const { mirror, listener } = this.context
    this.cancelWrite(id)
    await mirror.deletePending(this.projectId, id)
    const document = await mirror.getDocument(this.projectId, id)
    if (document) listener.onDocument(document, undefined)
    else listener.onRemoved(id)
    await this.refreshPending()
  }

  async keepMine(id: string) {
    const { mirror, listener } = this.context
    await this.flushEdit(id)
    const pending = await mirror.getPending(this.projectId, id)
    if (!pending || !pending.conflict || pending.conflict === 'deleted') return
    pending.baseEtag = pending.conflict.document.etag
    pending.baseText = pending.conflict.text
    pending.conflict = null
    await mirror.putPending(pending)
    const document = await mirror.getDocument(this.projectId, id)
    if (document) listener.onDocument(document, pending)
    await this.syncNow()
  }

  async discard(id: string) {
    const { mirror, listener } = this.context
    this.cancelWrite(id)
    await mirror.deletePending(this.projectId, id)
    await mirror.deleteDocument(this.projectId, id)
    listener.onRemoved(id)
    await this.refreshPending()
  }

  /** Joins the project's change messages, and joins again when a create gives the project its server ID. */
  private join() {
    if (this.joined === this.projectId) return
    if (this.joined) this.live.closeProject(this.joined)
    this.joined = this.projectId
    this.live.openProject(this.projectId)
  }

  private async pass() {
    this.passing = true
    clearTimeout(this.pushTimer)
    this.setStatus({ syncing: true })
    try {
      await this.flush()
      await this.locked(async () => {
        const replayed = await this.replayer.replay()
        this.join()
        const changes = this.incoming.splice(0)
        if (this.fullPull) {
          if (await this.puller.pull()) this.fullPull = false
        } else {
          await this.puller.apply(changes)
        }
        const pushed = await this.pusher.push()
        if (replayed || pushed) await publishView(this.context)
      })
      this.backoff = MIN_BACKOFF_MS
      this.setStatus({ online: true, error: '', lastSync: new Date().toISOString() })
      this.channel?.postMessage({ projectId: this.projectId })
      this.schedule(this.live.connected ? FULL_SYNC_LIVE_MS : FULL_SYNC_MS, true)
    } catch (ex) {
      this.fullPull = true
      if (isOffline(ex)) {
        this.setStatus({ online: false })
        this.schedule(this.backoff)
        this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS)
      } else {
        this.setStatus({ error: ex instanceof Error ? ex.message : 'Sync failed.' })
        this.schedule(FULL_SYNC_MS)
      }
    } finally {
      await this.refreshPending({ syncing: false })
      this.passing = false
      if (this.again) { this.again = false; void this.syncNow() }
    }
  }

  private onOnline = () => { this.backoff = MIN_BACKOFF_MS; this.requestFullPull(); void this.syncNow() }
  private onVisible = () => {
    if (document.visibilityState === 'hidden') void this.flush()
    else void this.syncNow()
  }

  private schedule(delay: number, full = false) {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => { if (full) this.requestFullPull(); void this.syncNow() }, delay)
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.context.listener.onStatus(this.status)
  }

  private async refreshPending(patch: Partial<SyncStatus> = {}) {
    this.setStatus({ ...patch, pending: await countPending(this.context) })
  }

  private cancelWrite(id: string) {
    const write = this.writes.get(id)
    if (write) { clearTimeout(write.timer); this.writes.delete(id) }
  }

  private async flushEdit(id: string) {
    return this.context.mutations.run(() => this.writeEdit(id))
  }

  private async writeEdit(key: string) {
    const write = this.writes.get(key)
    if (!write) return
    clearTimeout(write.timer)
    try { await this.storeEdit(resolveId(this.context, key), write.text) }
    // The edit counts as typing until it is stored, so that a server answer in between cannot replace it on screen.
    finally { if (this.writes.get(key) === write) this.writes.delete(key) }
    await this.refreshPending()
    this.syncSoon()
  }

  private async storeEdit(id: string, text: string) {
    const { mirror } = this.context
    const document = await mirror.getDocument(this.projectId, id)
    const existing = await mirror.getPending(this.projectId, id)
    if (existing?.conflict) {
      existing.text = text
      existing.updated = new Date().toISOString()
      await mirror.putPending(existing)
      return
    }
    if (document && text === document.text && document.textEtag === document.document.etag) {
      if (existing) await mirror.deletePending(this.projectId, id)
    } else if (document || existing) {
      await mirror.putPending({
        projectId: this.projectId, id, text, updated: new Date().toISOString(), conflict: null,
        baseEtag: existing?.baseEtag ?? document!.textEtag,
        baseText: existing ? existing.baseText : document!.text,
      })
    }
  }

  private async locked(run: () => Promise<void>): Promise<void> {
    const locks = navigator.locks
    if (locks) await locks.request(`odysseum-sync:${this.projectId}`, run)
    else await run()
  }
}
