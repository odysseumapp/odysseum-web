import type { IOdysseumApi } from '../api/IOdysseumApi'
import { isOffline } from '../api/IApiClient'
import type { Folder, ProjectInfo, ProjectTemplate, SessionInfo } from '../models'
import { newLocalId, type IMirrorRepository } from '../storage'
import { defaultTemplate } from './FolderStructure'

const TemplatesKey = 'odysseum:templates'

export class WorkspaceLibrary {
  constructor(private readonly api: IOdysseumApi, private readonly mirror: IMirrorRepository) {}

  async session(): Promise<SessionInfo | null> {
    try { return await this.api.getSession() }
    catch (ex) { if (isOffline(ex)) return null; throw ex }
  }

  login(password: string) { return this.api.login(password) }
  logout() { return this.api.logout() }

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
      const known = new Set(projects.map(project => project.id))
      for (const local of await this.mirror.listProjects()) {
        if (!known.has(local.id) && (await this.mirror.listOps(local.id)).some(pending => pending.op.type === 'createProject')) projects.push(local)
      }
      await this.mirror.putProjects(projects)
    }
    return { projects, online }
  }

  async templates(): Promise<ProjectTemplate[]> {
    try {
      const templates = await this.api.listTemplates()
      try { localStorage.setItem(TemplatesKey, JSON.stringify(templates)) } catch {  }
      return templates
    } catch (ex) {
      if (!isOffline(ex)) throw ex
      try {
        const stored = JSON.parse(localStorage.getItem(TemplatesKey) ?? 'null')
        if (Array.isArray(stored) && stored.length) return stored
      } catch {  }
      return [defaultTemplate]
    }
  }

  /** Makes the project on this device, with the template's folders. The server makes it, and its documents, on the next sync. */
  async create(title: string, template: ProjectTemplate = defaultTemplate): Promise<ProjectInfo> {
    const clean = title.trim()
    if (!clean) throw new Error('Enter a project title.')
    const projectId = newLocalId()
    const rootFolderId = newLocalId()
    const now = new Date().toISOString()
    const info: ProjectInfo = { id: projectId, name: clean, title: clean, wordGoal: template.wordGoal, defaultSceneWordGoal: template.defaultSceneWordGoal,
      rootFolderId, lastModified: now, warning: null, etag: '' }
    const byPath = new Map<string, Folder>([['', { id: rootFolderId, projectId, name: clean, parentFolderId: null, childIds: [], ownDocumentId: null,
      pinnedView: null, views: {}, etag: '' }]])
    const add = (path: string): Folder => {
      const existing = byPath.get(path)
      if (existing) return existing
      const parent = add(path.split('/').slice(0, -1).join('/'))
      const folder: Folder = { id: newLocalId(), projectId, name: path.split('/').at(-1)!, parentFolderId: parent.id, childIds: [], ownDocumentId: null,
        pinnedView: null, views: {}, etag: '' }
      byPath.set(path, folder)
      parent.childIds.push(folder.id)
      return folder
    }
    for (const folder of template.folders) add(folder.path).pinnedView = folder.pinnedView
    const names = new Map([...byPath.values()].map(folder => [folder.id, folder.name]))
    for (const { path, children } of template.folders) {
      const rank = (id: string) => { const index = children.indexOf(names.get(id) ?? ''); return index < 0 ? children.length : index }
      byPath.get(path)!.childIds.sort((a, b) => rank(a) - rank(b))
    }
    const settings = { title: clean, wordGoal: template.wordGoal, defaultSceneWordGoal: template.defaultSceneWordGoal }
    await this.mirror.putProject({ projectId, project: info, folders: [...byPath.values()], links: [], syncedAt: '' })
    await this.mirror.putOp({ projectId, op: { type: 'createProject', title: clean, settings, templateName: template.name, rootFolderId }, updated: now })
    await this.mirror.putProjects([...await this.mirror.listProjects(), info])
    return info
  }
}
