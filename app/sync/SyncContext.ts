import type { IOdysseumApi } from '../api/IOdysseumApi'
import type { IMirrorStore } from '../storage'
import type { ISyncListener } from './ISyncEngine'
import type { MutationQueue } from './MutationQueue'
import { renameInOp, type LocalOp } from '../storage/IMirrorStore'

/** What every sync step works with. `slug` can change once, when the server names a project created offline. */
export interface SyncContext {
  readonly api: IOdysseumApi
  readonly mirror: IMirrorStore
  slug: string
  readonly listener: ISyncListener
  readonly mutations: MutationQueue
  readonly documentIds: Map<string, string>
  replaying?: number
}

export function resolveDocumentId(context: SyncContext, id: string): string {
  while (context.documentIds.has(id)) id = context.documentIds.get(id)!
  return id
}

export function resolveOperation(context: SyncContext, op: LocalOp): LocalOp {
  for (const [from, to] of context.documentIds) op = renameInOp(op, from, to)
  return op
}
