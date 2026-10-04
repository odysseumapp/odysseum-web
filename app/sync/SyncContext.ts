import type { IOdysseumApi } from '../api/IOdysseumApi'
import type { DocumentSummary } from '../models'
import { replaceIdsIn, type IMirrorRepository, type LocalOp, type MirroredDocument, type MirroredProject } from '../storage/IMirrorRepository'
import type { ISyncListener } from './ISyncEngine'
import type { MutationQueue } from './MutationQueue'

export interface SyncContext {
  readonly api: IOdysseumApi
  readonly mirror: IMirrorRepository
  projectId: string
  readonly listener: ISyncListener
  readonly mutations: MutationQueue
  /** Local IDs that got server IDs, so that calls made with an old ID still find the item. */
  readonly ids: Map<string, string>
  replaying?: number
}

export function resolveId(context: SyncContext, id: string): string {
  while (context.ids.has(id)) id = context.ids.get(id)!
  return id
}

export const resolveOp = <T extends LocalOp>(context: SyncContext, op: T): T => context.ids.size ? replaceIdsIn(op, Object.fromEntries(context.ids)) : op

/** Gives items made on this device their server IDs in the mirror, the queue and the UI. */
export async function replaceIds(context: SyncContext, ids: Record<string, string>) {
  const changed = Object.fromEntries(Object.entries(ids).filter(([from, to]) => from !== to))
  if (!Object.keys(changed).length) return
  await context.mirror.replaceIds(context.projectId, changed)
  for (const [from, to] of Object.entries(changed)) context.ids.set(from, to)
  if (changed[context.projectId]) context.projectId = changed[context.projectId]!
  context.listener.onIdsReplaced(changed)
}

/** Reads the mirrored project, changes it and saves it. Only the sync pass calls this, so writes do not overlap. */
export async function changeProject(context: SyncContext, change: (project: MirroredProject) => void) {
  const mirrored = await context.mirror.getProject(context.projectId)
  if (!mirrored) return
  change(mirrored)
  await context.mirror.putProject(mirrored)
}

export function upsert<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex(existing => existing.id === item.id)
  if (index < 0) list.push(item)
  else list[index] = item
}

/** Stores a document that one of our own writes changed without changing its text (details, name or place). The text
 *  and a pending edit that were based on the old ETag stay valid, so they move to the new ETag. */
export async function advanceDocument(context: SyncContext, before: MirroredDocument | undefined, after: DocumentSummary) {
  const { mirror, projectId } = context
  const oldEtag = before?.document.etag
  const textEtag = before && before.textEtag === oldEtag ? after.etag : before?.textEtag ?? ''
  const stored: MirroredDocument = { projectId, id: after.id, document: after, text: before?.text ?? '', textEtag }
  await mirror.putDocuments([stored])
  const pending = await mirror.getPending(projectId, after.id)
  if (pending && oldEtag && pending.baseEtag === oldEtag) { pending.baseEtag = after.etag; await mirror.putPending(pending) }
  return stored
}
