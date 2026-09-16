export type DocumentStatus = 'draft' | 'revised' | 'done'
/** Derived from the document's top-level folder on the server; every kind shares the same file and metadata handling. */
export type DocumentKind = 'scene' | 'note' | 'character' | 'location' | 'thread'

export interface DocumentSummary {
  id: string; path: string; title: string; folder: string;
  synopsis: string; notes: string; status: DocumentStatus;
  wordGoal: number; order: number; wordCount: number; revision: string; lastModified: string;
  /** `links` are the documents this one is linked to, in both directions: characters, locations, threads, notes, anything. */
  kind: DocumentKind; links: string[];
}
export interface DocumentContent { document: DocumentSummary; content: string }
export interface ProjectSettings { title: string; wordGoal: number; defaultSceneWordGoal: number }
export type FolderView = 'write' | 'board' | 'outline' | 'grid'
export type GridAxis = 'rows' | 'columns'
/** The folder's grid: `rows` are document ids; `columns` are document ids, folder ids, or `folderId/*` for every document
 * under that folder in order (empty means this folder's children); `axis` says which way the rows run (rows by default). */
export interface FolderLayout { pinnedView: FolderView | null; itemOrder: string[]; rows: string[]; columns: string[]; axis: GridAxis | null }
export interface FolderSummary extends FolderLayout { id: string; path: string; name: string; parent: string | null }
export interface Project { id: string; settings: ProjectSettings; revision: string; documents: DocumentSummary[]; folders: FolderSummary[]; warning: string | null }
export interface ProjectInfo { slug: string; title: string; id: string; lastModified: string }
export interface ApiCollection<T> { totalItems: number; items: T[] }
export interface Snapshot { id: string; created: string; wordCount: number }
export interface SessionInfo { authenticated: boolean; passwordRequired: boolean; allowDeletingDefaultFolders: boolean }
/** Server settings the interface may change. */
export interface ServerSettings { allowDeletingDefaultFolders: boolean }
export interface SearchResult { document: DocumentSummary; excerpt: string }

/** The editable details of a scene, as shown in the inspector. */
export interface MetadataFields { title: string; synopsis: string; notes: string; status: DocumentStatus; wordGoal: number; links: string[] }

export const countWords = (text: string) => (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length
export const statusLabel = (status: string) => ({ draft: 'First draft', revised: 'In revision', done: 'Finished' }[status] ?? status)
