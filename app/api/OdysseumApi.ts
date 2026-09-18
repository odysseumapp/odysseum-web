import type { ApiCollection, DocumentContent, FolderLayout, MetadataFields, Project, ProjectInfo, ProjectSettings, ProjectTemplate, SearchResult, ServerSettings, SessionInfo, Snapshot, Theme } from '../models'
import type { IApiClient } from './IApiClient'
import type { IOdysseumApi } from './IOdysseumApi'

export class OdysseumApi implements IOdysseumApi {
  constructor(private readonly client: IApiClient) {}

  private project = (slug: string) => `/projects/${encodeURIComponent(slug)}`
  private document = (slug: string, id: string) => `${this.project(slug)}/documents/${encodeURIComponent(id)}`

  getSession() { return this.client.request<SessionInfo>('/session') }
  login(password: string) { return this.client.request<SessionInfo>('/login', 'POST', { password }) }
  logout() { return this.client.request('/logout', 'POST') }
  getServerSettings() { return this.client.request<ServerSettings>('/settings') }
  updateServerSettings(settings: ServerSettings) { return this.client.request<ServerSettings>('/settings', 'PUT', settings) }

  private theme = (name: string) => `/themes/${encodeURIComponent(name)}`
  async listThemes() { return (await this.client.request<ApiCollection<Theme>>('/themes')).items }
  saveTheme(theme: Theme) { return this.client.request<Theme>(this.theme(theme.name), 'PUT', { colors: theme.colors }) }
  deleteTheme(name: string) { return this.client.request(this.theme(name), 'DELETE') }

  private template = (name: string) => `/templates/${encodeURIComponent(name)}`
  async listTemplates() { return (await this.client.request<ApiCollection<ProjectTemplate>>('/templates')).items }
  saveTemplate(name: string, slug: string) { return this.client.request<ProjectTemplate>(this.template(name), 'PUT', { project: slug }) }
  deleteTemplate(name: string) { return this.client.request(this.template(name), 'DELETE') }

  async listProjects() { return (await this.client.request<ApiCollection<ProjectInfo>>('/projects')).items }
  createProject(title: string, wordGoal?: number, template?: string) { return this.client.request<ProjectInfo>('/projects', 'POST', { title, wordGoal, template }) }
  getProject(slug: string) { return this.client.request<Project>(this.project(slug)) }
  createFolder(slug: string, path: string, revision: string) { return this.client.request<Project>(`${this.project(slug)}/folders`, 'POST', { path, revision }) }
  removeFolder(slug: string, path: string, revision: string) { return this.client.request<Project>(`${this.project(slug)}/folders`, 'DELETE', { path, revision }) }
  saveFolderLayout(slug: string, path: string, layout: FolderLayout, revision: string) { return this.client.request<Project>(`${this.project(slug)}/folders/layout`, 'PUT', { path, ...layout, revision }) }
  updateSettings(slug: string, settings: ProjectSettings, revision: string) {
    return this.client.request<Project>(`${this.project(slug)}/settings`, 'PUT', { ...settings, revision })
  }
  reorder(slug: string, ids: string[], revision: string) { return this.client.request<Project>(`${this.project(slug)}/order`, 'PUT', { ids, revision }) }
  async search(slug: string, query: string) {
    return (await this.client.request<ApiCollection<SearchResult>>(`${this.project(slug)}/search?q=${encodeURIComponent(query)}`)).items
  }
  eventsUrl(slug: string) { return `/api${this.project(slug)}/events` }

  async listDocuments(slug: string) { return (await this.client.request<ApiCollection<DocumentContent>>(`${this.project(slug)}/documents`)).items }
  getDocument(slug: string, id: string) { return this.client.request<DocumentContent>(this.document(slug, id)) }
  createDocument(slug: string, title: string, folder: string, content?: string) {
    return this.client.request<DocumentContent>(`${this.project(slug)}/documents`, 'POST', { title, folder, content })
  }
  saveDocument(slug: string, id: string, content: string, revision: string) {
    return this.client.request<DocumentContent>(this.document(slug, id), 'PUT', { content, revision })
  }
  updateMetadata(slug: string, id: string, fields: MetadataFields, revision: string) {
    return this.client.request<Project>(`${this.document(slug, id)}/metadata`, 'PUT', { ...fields, revision })
  }
  moveDocument(slug: string, id: string, path: string, revision: string) {
    return this.client.request<DocumentContent>(`${this.document(slug, id)}/path`, 'PUT', { path, revision })
  }
  async listSnapshots(slug: string, id: string) { return (await this.client.request<ApiCollection<Snapshot>>(`${this.document(slug, id)}/snapshots`)).items }
  async getSnapshot(slug: string, id: string, snapshot: string) {
    return (await this.client.request<{ content: string }>(`${this.document(slug, id)}/snapshots/${encodeURIComponent(snapshot)}`)).content
  }
}
