import type { IOdysseumApi } from '../api/IOdysseumApi'
import { isOffline } from '../api/IApiClient'
import type { ProjectInfo, ProjectTemplate, SessionInfo } from '../models'
import type { IMirrorStore } from '../storage'
import { projectSlugFor } from './FileNames'
import { completeFolders, defaultTemplate, folderFor } from './FolderStructure'

const TemplatesKey = 'odysseum:templates'

/** The list of projects and the creation of new ones; works from the local copy when the server is away. */
export class WorkspaceLibrary {
  constructor(private readonly api: IOdysseumApi, private readonly mirror: IMirrorStore) {}

  /** Null when the server cannot be reached; the caller decides whether the local copy is enough to proceed. */
  async session(): Promise<SessionInfo | null> {
    try { return await this.api.getSession() }
    catch (ex) { if (isOffline(ex)) return null; throw ex }
  }

  login(password: string) { return this.api.login(password) }
  logout() { return this.api.logout() }

  /** Server list merged with projects created here that the server has not seen yet. */
  async list(): Promise<{ projects: ProjectInfo[]; online: boolean }> {
    let projects: ProjectInfo[]
    let online: boolean
    try {
      projects = await this.api.listProjects()
      online = true
    } catch (ex) {
      if (!isOffline(ex)) throw ex
      projects = await this.mirror.listProjects()
      online = false
    }
    if (online) {
      const known = new Set(projects.map(project => project.slug))
      for (const local of await this.mirror.listProjects()) {
        if (!known.has(local.slug) && (await this.mirror.listOps(local.slug)).some(pending => pending.op.type === 'createProject')) projects.push(local)
      }
      await this.mirror.putProjects(projects)
    }
    return { projects, online }
  }

  /** The templates a new project can start from. Offline it is the list this browser last saw, so a project can still be made. */
  async templates(): Promise<ProjectTemplate[]> {
    try {
      const templates = await this.api.listTemplates()
      try { localStorage.setItem(TemplatesKey, JSON.stringify(templates)) } catch { /* Storage may be unavailable. */ }
      return templates
    } catch (ex) {
      if (!isOffline(ex)) throw ex
      try {
        const stored = JSON.parse(localStorage.getItem(TemplatesKey) ?? 'null')
        if (Array.isArray(stored) && stored.length) return stored
      } catch { /* Storage may be unavailable, or hold something this build cannot read. */ }
      return [defaultTemplate]
    }
  }

  /**
   * Creates the project on this device first; the folder is created on the server when the project syncs.
   * Until then the project shows the template's folders; its documents are written by the server and arrive with that sync.
   */
  async create(title: string, template: ProjectTemplate = defaultTemplate): Promise<ProjectInfo> {
    const clean = title.trim()
    const existing = await this.mirror.listProjects()
    const slug = projectSlugFor(clean, new Set(existing.map(project => project.slug.toLowerCase())))
    const settings = { title: clean, ...template.settings }
    const info: ProjectInfo = { slug, title: clean, id: crypto.randomUUID(), lastModified: new Date().toISOString() }
    const folders = completeFolders(template.folders.map(folder => ({ ...folderFor(folder.path, clean), pinnedView: folder.pinnedView,
      itemOrder: folder.itemOrder.filter(key => key.startsWith('folder:')) })), [], clean)
    await this.mirror.putProject({ slug, project: { id: info.id, settings, revision: '', documents: [], folders, warning: null }, syncedAt: '' })
    await this.mirror.putOp({ slug, op: { type: 'createProject', title: clean, settings, template: template.name }, updated: info.lastModified })
    await this.mirror.putProjects([...existing, info])
    return info
  }
}
