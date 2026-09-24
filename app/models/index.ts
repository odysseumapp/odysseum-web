export type DocumentStatus = 'draft' | 'revised' | 'done'
export type DocumentKind = 'scene' | 'note' | 'character' | 'location' | 'thread' | 'style'

export interface DocumentSummary {
  id: string; path: string; title: string; folder: string;
  synopsis: string; notes: string; status: DocumentStatus;
  wordGoal: number; order: number; wordCount: number; revision: string; lastModified: string;
  kind: DocumentKind; links: string[];
  linkNotes: Record<string, string>;
}
export interface DocumentContent { document: DocumentSummary; content: string }
export interface ProjectSettings { title: string; wordGoal: number; defaultSceneWordGoal: number }
export type FolderView = 'write' | 'board' | 'outline' | 'grid'
export interface FolderLayout { pinnedView: FolderView | null; itemOrder: string[]; gridFolder: string | null }
export interface FolderSummary extends FolderLayout { id: string; path: string; name: string; parent: string | null }
export interface Project { id: string; settings: ProjectSettings; revision: string; documents: DocumentSummary[]; folders: FolderSummary[]; warning: string | null }
export interface ProjectInfo { slug: string; title: string; id: string; lastModified: string }
export interface ApiCollection<T> { totalItems: number; items: T[] }
export interface Snapshot { id: string; created: string; wordCount: number }
export interface ProjectVersion { id: string; name: string | null; automatic: boolean; saved: string; changes: number }
export interface SessionInfo { authenticated: boolean; passwordRequired: boolean; allowDeletingDefaultFolders: boolean }
export interface ServerSettings { allowDeletingDefaultFolders: boolean }
export interface SearchResult { document: DocumentSummary; excerpt: string }

export const themeRoles = ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] as const
export type ThemeRole = typeof themeRoles[number]
export type ThemeColors = Record<ThemeRole, string>
export interface Theme { name: string; colors: ThemeColors }

export interface TemplateFolder { path: string; pinnedView: FolderView | null; itemOrder: string[]; gridFolder: string | null }
export interface ProjectTemplate {
  name: string
  settings: { wordGoal: number; defaultSceneWordGoal: number }
  folders: TemplateFolder[]
  documents: { path: string; title: string }[]
}

export interface MetadataFields { title: string; synopsis: string; notes: string; status: DocumentStatus; wordGoal: number; links: string[]; linkNotes: Record<string, string> }

export const countWords = (text: string) => (text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length
export const statusLabel = (status: string) => ({ draft: 'First draft', revised: 'In revision', done: 'Finished' }[status] ?? status)
