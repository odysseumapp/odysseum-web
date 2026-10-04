import type {
  ApiCollection, DocumentDetails, DocumentMove, DocumentSummary, DocumentText, Folder, FolderLayoutChange, FolderMove, Link, PluginInfo,
  ProjectInfo, ProjectSettings, ProjectTemplate, ServerSearchResult, ServerSettings, SessionInfo, Theme, Version,
} from '../models'
import type { IApiClient } from './IApiClient'
import type { IOdysseumApi } from './IOdysseumApi'

const id = encodeURIComponent

export class OdysseumApi implements IOdysseumApi {
  constructor(private readonly client: IApiClient) {}

  private get<T>(path: string) { return this.client.request<T>(path) }
  private async list<T>(path: string) { return (await this.client.request<ApiCollection<T>>(path)).items }
  private send<T>(method: string, path: string, body?: unknown, ifMatch?: string) { return this.client.request<T>(path, { method, body, ifMatch }) }

  getSession() { return this.get<SessionInfo>('/session') }
  login(password: string) { return this.send<SessionInfo>('POST', '/login', { password }) }
  async logout() { await this.send('POST', '/logout') }
  getServerSettings() { return this.get<ServerSettings>('/settings') }
  updateServerSettings(settings: ServerSettings) { return this.send<ServerSettings>('PUT', '/settings', settings) }
  listPlugins() { return this.list<PluginInfo>('/plugins') }

  listThemes() { return this.list<Theme>('/themes') }
  saveTheme(theme: Theme) { return this.send<Theme>('PUT', `/themes/${id(theme.name)}`, { colors: theme.colors }) }
  async deleteTheme(name: string) { await this.send('DELETE', `/themes/${id(name)}`) }

  listTemplates() { return this.list<ProjectTemplate>('/templates') }
  saveTemplate(name: string, projectId: string) { return this.send<ProjectTemplate>('PUT', `/templates/${id(name)}`, { projectId }) }
  async deleteTemplate(name: string) { await this.send('DELETE', `/templates/${id(name)}`) }

  listProjects() { return this.list<ProjectInfo>('/projects') }
  createProject(title: string, wordGoal?: number, templateName?: string) { return this.send<ProjectInfo>('POST', '/projects', { title, wordGoal, templateName }) }
  getProject(projectId: string) { return this.get<ProjectInfo>(`/projects/${id(projectId)}`) }
  updateProjectSettings(projectId: string, settings: ProjectSettings, etag: string) {
    return this.send<ProjectInfo>('PUT', `/projects/${id(projectId)}/settings`, settings, etag)
  }
  searchDocuments(projectId: string, text: string) { return this.list<ServerSearchResult>(`/projects/${id(projectId)}/search?text=${id(text)}`) }

  listVersions(projectId: string) { return this.list<Version>(`/projects/${id(projectId)}/versions`) }
  saveVersion(projectId: string, name: string) { return this.send<Version>('POST', `/projects/${id(projectId)}/versions`, { name }) }
  restoreVersion(projectId: string, versionId: string) { return this.send<ProjectInfo>('POST', `/projects/${id(projectId)}/versions/${id(versionId)}/restore`) }

  listFolders(projectId: string) { return this.list<Folder>(`/projects/${id(projectId)}/folders`) }
  getFolder(folderId: string) { return this.get<Folder>(`/folders/${id(folderId)}`) }
  createFolder(parentFolderId: string, name: string) { return this.send<Folder>('POST', '/folders', { parentFolderId, name }) }
  updateFolderLayout(folderId: string, layout: FolderLayoutChange, etag: string) { return this.send<Folder>('PUT', `/folders/${id(folderId)}/layout`, layout, etag) }
  moveFolder(folderId: string, targetFolderId: string, index: number, etag: string) {
    return this.send<FolderMove>('PUT', `/folders/${id(folderId)}/parent`, { targetFolderId, index }, etag)
  }
  async deleteFolder(folderId: string, etag: string) { await this.send('DELETE', `/folders/${id(folderId)}`, undefined, etag) }

  listDocuments(projectId: string) { return this.list<DocumentSummary>(`/projects/${id(projectId)}/documents`) }
  getDocument(documentId: string) { return this.get<DocumentSummary>(`/documents/${id(documentId)}`) }
  getDocumentText(documentId: string) { return this.get<DocumentText>(`/documents/${id(documentId)}/text`) }
  createDocument(folderId: string, title: string, text?: string) { return this.send<DocumentSummary>('POST', '/documents', { folderId, title, text }) }
  updateDocumentText(documentId: string, text: string, etag: string) { return this.send<DocumentSummary>('PUT', `/documents/${id(documentId)}/text`, { text }, etag) }
  updateDocumentDetails(documentId: string, details: DocumentDetails, etag: string) {
    return this.send<DocumentSummary>('PUT', `/documents/${id(documentId)}/details`, details, etag)
  }
  renameDocument(documentId: string, name: string, etag: string) { return this.send<DocumentSummary>('PUT', `/documents/${id(documentId)}/name`, { name }, etag) }
  moveDocument(documentId: string, targetFolderId: string, index: number, etag: string) {
    return this.send<DocumentMove>('PUT', `/documents/${id(documentId)}/folder`, { targetFolderId, index }, etag)
  }
  listDocumentVersions(documentId: string) { return this.list<Version>(`/documents/${id(documentId)}/versions`) }
  async getDocumentVersionText(documentId: string, versionId: string) {
    return (await this.get<{ text: string }>(`/documents/${id(documentId)}/versions/${id(versionId)}/text`)).text
  }

  listLinks(projectId: string) { return this.list<Link>(`/projects/${id(projectId)}/links`) }
  getLink(linkId: string) { return this.get<Link>(`/links/${id(linkId)}`) }
  createLink(firstDocumentId: string, secondDocumentId: string, note = '') { return this.send<Link>('POST', '/links', { firstDocumentId, secondDocumentId, note }) }
  updateLinkNote(linkId: string, note: string, etag: string) { return this.send<Link>('PUT', `/links/${id(linkId)}/note`, { note }, etag) }
  async deleteLink(linkId: string, etag: string) { await this.send('DELETE', `/links/${id(linkId)}`, undefined, etag) }
}
