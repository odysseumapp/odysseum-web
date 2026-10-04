export type DocumentStatus = 'draft' | 'revised' | 'done'
export type DocumentKind = 'scene' | 'note' | 'character' | 'location' | 'thread' | 'style'

export interface ProjectInfo {
  id: string; name: string; title: string; wordGoal: number; defaultSceneWordGoal: number;
  rootFolderId: string; lastModified: string; warning: string | null; etag: string;
}
export interface ProjectSettings { title: string; wordGoal: number; defaultSceneWordGoal: number }
export type ViewSettings = Record<string, unknown>
export interface Folder {
  id: string; projectId: string; name: string; parentFolderId: string | null; childIds: string[];
  ownDocumentId: string | null; pinnedView: string | null; views: Record<string, ViewSettings>; etag: string;
}
export interface DocumentSummary {
  id: string; projectId: string; folderId: string; name: string; kind: DocumentKind; isFolderDocument: boolean;
  title: string; synopsis: string; notes: string; status: DocumentStatus; wordGoal: number; wordCount: number;
  lastModified: string; etag: string;
}
export interface DocumentText { documentId: string; text: string; etag: string }
export interface DocumentDetails { title: string; synopsis: string; notes: string; status: DocumentStatus; wordGoal: number }
export interface Link { id: string; projectId: string; firstDocumentId: string; secondDocumentId: string; note: string; etag: string }
export interface DocumentMove { document: DocumentSummary; oldFolder: Folder; newFolder: Folder }
export interface FolderMove { folder: Folder; oldParentFolder: Folder; newParentFolder: Folder }

/** The project as the UI shows it: the server's items with the local changes that are not sent yet. */
export interface ProjectSnapshot { project: ProjectInfo; folders: Folder[]; documents: DocumentSummary[]; links: Link[] }

/** The name of a view. The core knows only 'write'; plugins add the others. */
export type FolderView = string
export const WRITE_VIEW: FolderView = 'write'
/** A change to a folder's layout. A view in `views` gets those settings; null removes them; views not given keep theirs. */
export interface FolderLayoutChange { pinnedView: FolderView | null; views?: Record<string, ViewSettings | null> }

export interface ApiCollection<T> { totalItems: number; items: T[] }
export interface Version { id: string; name: string | null; automatic: boolean; saved: string; changes: number }
export interface SessionInfo { authenticated: boolean; passwordRequired: boolean; allowDeletingDefaultFolders: boolean }
export interface ServerSettings { allowDeletingDefaultFolders: boolean }
export interface ServerSearchResult { documentId: string; title: string; excerpt: string }
export interface SearchResult { document: DocumentSummary; excerpt: string }

export type PluginStatus = 'enabled' | 'disabled' | 'failed'
export interface PluginInfo { id: string; name: string; version: string; status: PluginStatus; error?: string; clientEntry: string | null }

export type ItemType = 'project' | 'folder' | 'document' | 'link'
export type ChangeKind = 'added' | 'updated' | 'moved' | 'removed'
export interface ItemChange { type: ItemType; kind: ChangeKind; id: string; etag: string | null }
export interface ChangedMessage { projectId: string; changes: ItemChange[] }

export const themeRoles = ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] as const
export type ThemeRole = typeof themeRoles[number]
export type ThemeColors = Record<ThemeRole, string>
export interface Theme { name: string; colors: ThemeColors }

export interface TemplateFolder { path: string; pinnedView: FolderView | null; children: string[]; views: Record<string, ViewSettings> | null }
export interface ProjectTemplate {
  name: string; wordGoal: number; defaultSceneWordGoal: number;
  folders: TemplateFolder[]; documents: { path: string; title: string }[];
}

export const settingsOf = (project: ProjectInfo): ProjectSettings =>
  ({ title: project.title, wordGoal: project.wordGoal, defaultSceneWordGoal: project.defaultSceneWordGoal })
export const detailsOf = (doc: DocumentSummary | DocumentDetails): DocumentDetails =>
  ({ title: doc.title, synopsis: doc.synopsis, notes: doc.notes, status: doc.status, wordGoal: doc.wordGoal })
export const statusLabel = (status: string) => ({ draft: 'First draft', revised: 'In revision', done: 'Finished' }[status] ?? status)
