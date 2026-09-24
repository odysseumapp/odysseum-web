import type { DocumentContent, DocumentSummary, FolderLayout, MetadataFields, Project, ProjectInfo, ProjectSettings, Snapshot } from '../models'

export interface MirroredProject { slug: string; project: Project; syncedAt: string }

export interface MirroredDocument { slug: string; id: string; document: DocumentSummary; content: string }

export interface PendingEdit {
  slug: string
  id: string
  content: string
  baseRevision: string
  updated: string
  conflict: DocumentContent | 'deleted' | null
}

export type LocalOp =
  | { type: 'createProject'; title: string; settings: ProjectSettings; template?: string }
  | { type: 'create'; id: string; title: string; folder: string; path: string; content: string }
  | { type: 'metadata'; id: string; fields: MetadataFields; base: MetadataFields }
  | { type: 'move'; id: string; path: string }
  | { type: 'order'; ids: string[] }
  | { type: 'settings'; settings: ProjectSettings }
  | { type: 'createFolder'; path: string }
  | { type: 'removeFolder'; path: string }
  | { type: 'folderLayout'; path: string; patch: Partial<FolderLayout> }
export interface PendingOp { seq?: number; slug: string; op: LocalOp; updated: string }

export interface CachedSnapshots { slug: string; id: string; list: Snapshot[]; contents: Record<string, string> }

export interface IMirrorStore {
  readonly durable: boolean

  listProjects(): Promise<ProjectInfo[]>
  putProjects(projects: ProjectInfo[]): Promise<void>
  getProject(slug: string): Promise<MirroredProject | undefined>
  putProject(project: MirroredProject): Promise<void>
  renameProject(from: string, to: string): Promise<void>

  listDocuments(slug: string): Promise<MirroredDocument[]>
  getDocument(slug: string, id: string): Promise<MirroredDocument | undefined>
  putDocuments(documents: MirroredDocument[]): Promise<void>
  deleteDocument(slug: string, id: string): Promise<void>
  renameDocument(slug: string, from: string, to: string): Promise<void>

  listPending(slug: string): Promise<PendingEdit[]>
  getPending(slug: string, id: string): Promise<PendingEdit | undefined>
  putPending(edit: PendingEdit): Promise<void>
  deletePending(slug: string, id: string): Promise<void>

  listOps(slug: string): Promise<PendingOp[]>
  putOp(op: PendingOp): Promise<PendingOp>
  deleteOp(seq: number): Promise<void>

  getSnapshots(slug: string, id: string): Promise<CachedSnapshots | undefined>
  putSnapshots(snapshots: CachedSnapshots): Promise<void>
}

export function renameInOp(op: LocalOp, from: string, to: string): LocalOp {
  switch (op.type) {
    case 'create': case 'move': return op.id === from ? { ...op, id: to } : op
    case 'metadata': {
      const swap = (ids: string[] = []) => ids.map(id => id === from ? to : id)
      const notes = (map: Record<string, string> = {}) => Object.fromEntries(Object.entries(map).map(([id, note]) => [id === from ? to : id, note]))
      const links = (fields: MetadataFields) => ({ ...fields, links: swap(fields.links), linkNotes: notes(fields.linkNotes) })
      const renamed = { ...op, fields: links(op.fields), base: links(op.base) }
      return op.id === from ? { ...renamed, id: to } : renamed
    }
    case 'order': return { ...op, ids: op.ids.map(id => id === from ? to : id) }
    case 'folderLayout': return { ...op, patch: { ...op.patch,
      ...(op.patch.itemOrder ? { itemOrder: op.patch.itemOrder.map(id => id === from ? to : id) } : {}),
    } }
    default: return op
  }
}
