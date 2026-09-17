export type DocumentStatus = 'draft' | 'revised' | 'done'
/** Derived from the document's top-level folder on the server; every kind shares the same file and metadata handling. */
export type DocumentKind = 'scene' | 'note' | 'character' | 'location' | 'thread'

export interface DocumentSummary {
  id: string; path: string; title: string; folder: string;
  synopsis: string; notes: string; status: DocumentStatus;
  wordGoal: number; order: number; wordCount: number; revision: string; lastModified: string;
  /** `links` are the documents this one is linked to, in both directions: characters, locations, threads, notes, anything. */
  kind: DocumentKind; links: string[];
  /** A note on a link, keyed by the linked document's id. The note is shared: both ends read the same text. */
  linkNotes: Record<string, string>;
}
export interface DocumentContent { document: DocumentSummary; content: string }
export interface ProjectSettings { title: string; wordGoal: number; defaultSceneWordGoal: number }
export type FolderView = 'write' | 'board' | 'outline' | 'grid'
/** `gridFolder` is the id of the folder whose documents are the columns of this folder's grid; null picks a default. */
export interface FolderLayout { pinnedView: FolderView | null; itemOrder: string[]; gridFolder: string | null }
export interface FolderSummary extends FolderLayout { id: string; path: string; name: string; parent: string | null }
export interface Project { id: string; settings: ProjectSettings; revision: string; documents: DocumentSummary[]; folders: FolderSummary[]; warning: string | null }
export interface ProjectInfo { slug: string; title: string; id: string; lastModified: string }
export interface ApiCollection<T> { totalItems: number; items: T[] }
export interface Snapshot { id: string; created: string; wordCount: number }
export interface SessionInfo { authenticated: boolean; passwordRequired: boolean; allowDeletingDefaultFolders: boolean }
/** Server settings the interface may change. */
export interface ServerSettings { allowDeletingDefaultFolders: boolean }
export interface SearchResult { document: DocumentSummary; excerpt: string }

/** Every part of the interface a theme colours. */
export const themeRoles = ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] as const
export type ThemeRole = typeof themeRoles[number]
/** One Tailwind palette name per role, such as `{ primary: 'emerald', … }`. */
export type ThemeColors = Record<ThemeRole, string>
/** A colour scheme saved on the server, one JSON file per name. */
export interface Theme { name: string; colors: ThemeColors }

/** The editable details of a scene, as shown in the inspector. */
export interface MetadataFields { title: string; synopsis: string; notes: string; status: DocumentStatus; wordGoal: number; links: string[]; linkNotes: Record<string, string> }

export const countWords = (text: string) => (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length
export const statusLabel = (status: string) => ({ draft: 'First draft', revised: 'In revision', done: 'Finished' }[status] ?? status)
