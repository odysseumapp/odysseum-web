import type { DocumentDetails, ItemChange, ProjectSnapshot } from '../models'
import type { MirroredDocument, PendingEdit } from '../storage'

export interface SyncStatus {
  online: boolean
  syncing: boolean
  pending: number
  lastSync: string | null
  error: string
}

export interface ISyncListener {
  onProject(view: ProjectSnapshot): void
  onDocument(document: MirroredDocument, pending: PendingEdit | undefined): void
  /** Items made on this device got their server IDs. The map can hold the project's own ID. */
  onIdsReplaced(ids: Record<string, string>): void
  onRemoved(id: string): void
  onStatus(status: SyncStatus): void
  onProblem(message: string): void
  onDetailsRejected(id: string, fields: DocumentDetails, message: string): void
  isOpen(id: string): boolean
}

export interface ISyncEngine {
  readonly projectId: string
  start(): void
  stop(): void
  syncNow(): Promise<void>
  syncSoon(delay?: number): void
  /** Changes the server reported for this project. They are read in the next sync pass. */
  receive(changes: ItemChange[]): void
  /** Read the whole project again in the next sync pass, e.g. after a version restore. */
  requestFullPull(): void
  edit(id: string, text: string): void
  flush(): Promise<void>
  hasUnwritten(): boolean
  isWriting(id: string): boolean
  useServer(id: string): Promise<void>
  keepMine(id: string): Promise<void>
  discard(id: string): Promise<void>
}
