import type { MetadataFields, Project } from '../models'
import type { MirroredDocument, PendingEdit } from '../storage'

export interface SyncStatus {
  online: boolean
  syncing: boolean
  pending: number
  lastSync: string | null
  error: string
}

export interface ISyncListener {
  onProject(project: Project): void
  onDocument(document: MirroredDocument, pending: PendingEdit | undefined): void
  onDocumentRenamed(from: string, to: string): void
  onRemoved(id: string): void
  onProjectRenamed(slug: string): void
  onStatus(status: SyncStatus): void
  onProblem(message: string): void
  onMetadataRejected(id: string, fields: MetadataFields, message: string): void
  isOpen(id: string): boolean
}

export interface ISyncEngine {
  readonly slug: string
  start(): void
  stop(): void
  renameDocument(from: string, to: string): void
  syncNow(): Promise<void>
  syncSoon(delay?: number): void
  edit(id: string, content: string): void
  flush(): Promise<void>
  hasUnwritten(): boolean
  isWriting(id: string): boolean
  useServer(id: string): Promise<void>
  keepMine(id: string): Promise<void>
  discard(id: string): Promise<void>
}
