import type {
  DocumentDetails, DocumentMove, DocumentSummary, DocumentText, Folder, FolderLayoutChange, FolderMove, Link, PluginInfo, ProjectInfo,
  ProjectSettings, ProjectTemplate, ServerSearchResult, ServerSettings, SessionInfo, Theme, Version,
} from '../models'

/** The server's HTTP API. Every write that changes an existing item takes the item's ETag. */
export interface IOdysseumApi {
  getSession(): Promise<SessionInfo>
  login(password: string): Promise<SessionInfo>
  logout(): Promise<void>
  getServerSettings(): Promise<ServerSettings>
  updateServerSettings(settings: ServerSettings): Promise<ServerSettings>
  listPlugins(): Promise<PluginInfo[]>

  listThemes(): Promise<Theme[]>
  saveTheme(theme: Theme): Promise<Theme>
  deleteTheme(name: string): Promise<void>

  listTemplates(): Promise<ProjectTemplate[]>
  saveTemplate(name: string, projectId: string): Promise<ProjectTemplate>
  deleteTemplate(name: string): Promise<void>

  listProjects(): Promise<ProjectInfo[]>
  createProject(title: string, wordGoal?: number, templateName?: string): Promise<ProjectInfo>
  getProject(projectId: string): Promise<ProjectInfo>
  updateProjectSettings(projectId: string, settings: ProjectSettings, etag: string): Promise<ProjectInfo>
  searchDocuments(projectId: string, text: string): Promise<ServerSearchResult[]>

  listVersions(projectId: string): Promise<Version[]>
  saveVersion(projectId: string, name: string): Promise<Version>
  restoreVersion(projectId: string, versionId: string): Promise<ProjectInfo>

  listFolders(projectId: string): Promise<Folder[]>
  getFolder(folderId: string): Promise<Folder>
  createFolder(parentFolderId: string, name: string): Promise<Folder>
  updateFolderLayout(folderId: string, layout: FolderLayoutChange, etag: string): Promise<Folder>
  moveFolder(folderId: string, targetFolderId: string, index: number, etag: string): Promise<FolderMove>
  deleteFolder(folderId: string, etag: string): Promise<void>

  listDocuments(projectId: string): Promise<DocumentSummary[]>
  getDocument(documentId: string): Promise<DocumentSummary>
  getDocumentText(documentId: string): Promise<DocumentText>
  createDocument(folderId: string, title: string, text?: string): Promise<DocumentSummary>
  updateDocumentText(documentId: string, text: string, etag: string): Promise<DocumentSummary>
  updateDocumentDetails(documentId: string, details: DocumentDetails, etag: string): Promise<DocumentSummary>
  renameDocument(documentId: string, name: string, etag: string): Promise<DocumentSummary>
  moveDocument(documentId: string, targetFolderId: string, index: number, etag: string): Promise<DocumentMove>
  listDocumentVersions(documentId: string): Promise<Version[]>
  getDocumentVersionText(documentId: string, versionId: string): Promise<string>

  listLinks(projectId: string): Promise<Link[]>
  getLink(linkId: string): Promise<Link>
  createLink(firstDocumentId: string, secondDocumentId: string, note?: string): Promise<Link>
  updateLinkNote(linkId: string, note: string, etag: string): Promise<Link>
  deleteLink(linkId: string, etag: string): Promise<void>
}
