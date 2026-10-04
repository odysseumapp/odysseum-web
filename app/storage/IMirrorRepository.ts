import type { DocumentDetails, DocumentSummary, Folder, Link, PluginInfo, ProjectInfo, ProjectSettings, Version, ViewSettings } from '../models'

/** The project as the server last gave it, without the documents. */
export interface MirroredProject { projectId: string; project: ProjectInfo; folders: Folder[]; links: Link[]; syncedAt: string }

/** A document and its text. `textEtag` is the document's ETag when the text was read; when it differs from
 *  `document.etag`, the text may be out of date. Both are empty for a document made on this device. */
export interface MirroredDocument { projectId: string; id: string; document: DocumentSummary; text: string; textEtag: string }

export interface PendingEdit {
  projectId: string
  id: string
  text: string
  /** The document's ETag when its text was last read. Empty while the document exists only on this device. */
  baseEtag: string
  /** The server's text the edit started from, or the server version the user chose to save over. A refused save goes
   *  through again when the server still has this text, even if its ETag changed. */
  baseText?: string
  updated: string
  conflict: { document: DocumentSummary; text: string } | 'deleted' | null
}

export type LocalOp =
  | { type: 'createProject'; title: string; settings: ProjectSettings; templateName?: string; rootFolderId: string }
  | { type: 'settings'; settings: ProjectSettings }
  | { type: 'createFolder'; localId: string; parentFolderId: string; name: string }
  | { type: 'deleteFolder'; folderId: string }
  | { type: 'layout'; folderId: string; pinnedView?: string | null; views?: Record<string, ViewSettings | null> }
  | { type: 'createDocument'; localId: string; folderId: string; title: string; text: string }
  | { type: 'details'; documentId: string; fields: DocumentDetails; base: DocumentDetails }
  | { type: 'rename'; documentId: string; name: string }
  | { type: 'move'; itemType: 'document' | 'folder'; itemId: string; targetFolderId: string; index: number }
  | { type: 'createLink'; localId: string; firstDocumentId: string; secondDocumentId: string; note: string }
  | { type: 'deleteLink'; linkId: string }
  | { type: 'linkNote'; linkId: string; note: string }
export interface PendingOp { seq?: number; projectId: string; op: LocalOp; updated: string }

export interface CachedVersions { projectId: string; id: string; list: Version[]; texts: Record<string, string> }

/** The browser's copy of the projects, and the changes that are not on the server yet. Keyed by project ID. */
export interface IMirrorRepository {
  readonly durable: boolean

  listProjects(): Promise<ProjectInfo[]>
  putProjects(projects: ProjectInfo[]): Promise<void>
  getProject(projectId: string): Promise<MirroredProject | undefined>
  putProject(project: MirroredProject): Promise<void>

  listDocuments(projectId: string): Promise<MirroredDocument[]>
  getDocument(projectId: string, id: string): Promise<MirroredDocument | undefined>
  putDocuments(documents: MirroredDocument[]): Promise<void>
  deleteDocument(projectId: string, id: string): Promise<void>

  listPending(projectId: string): Promise<PendingEdit[]>
  getPending(projectId: string, id: string): Promise<PendingEdit | undefined>
  putPending(edit: PendingEdit): Promise<void>
  deletePending(projectId: string, id: string): Promise<void>

  listOps(projectId: string): Promise<PendingOp[]>
  putOp(op: PendingOp): Promise<PendingOp>
  deleteOp(seq: number): Promise<void>

  getVersions(projectId: string, id: string): Promise<CachedVersions | undefined>
  putVersions(versions: CachedVersions): Promise<void>

  getPlugins(): Promise<PluginInfo[] | undefined>
  putPlugins(plugins: PluginInfo[]): Promise<void>

  /** Replaces IDs everywhere in one project's records: items made on this device get the server's IDs. A key of the map
   *  can be the project ID itself; the records then move to the new project ID. */
  replaceIds(projectId: string, ids: Record<string, string>): Promise<void>
}

/** Local IDs are unique strings, so a replace in the JSON text finds every use: IDs, parent IDs, child lists and ops. */
export function replaceIdsIn<T>(value: T, ids: Record<string, string>): T {
  let json = JSON.stringify(value)
  for (const [from, to] of Object.entries(ids)) if (from !== to) json = json.replaceAll(JSON.stringify(from), JSON.stringify(to))
  return JSON.parse(json) as T
}

export const isLocalId = (id: string) => id.startsWith('local-')
export const newLocalId = () => `local-${crypto.randomUUID()}`
