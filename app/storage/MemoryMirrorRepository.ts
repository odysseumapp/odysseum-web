import type { PluginInfo, ProjectInfo } from '../models'
import { replaceIdsIn, type CachedVersions, type IMirrorRepository, type MirroredDocument, type MirroredProject, type PendingEdit, type PendingOp } from './IMirrorRepository'

export class MemoryMirrorRepository implements IMirrorRepository {
  readonly durable = false
  private projects: ProjectInfo[] = []
  private plugins: PluginInfo[] | undefined
  private mirrored = new Map<string, MirroredProject>()
  private documents = new Map<string, MirroredDocument>()
  private pending = new Map<string, PendingEdit>()
  private versions = new Map<string, CachedVersions>()
  private ops = new Map<number, PendingOp>()
  private nextSeq = 1
  private key = (projectId: string, id: string) => `${projectId} ${id}`
  private inProject = <T extends { projectId: string }>(map: Map<unknown, T>, projectId: string) => [...map.values()].filter(row => row.projectId === projectId)

  async listProjects() { return this.projects }
  async putProjects(projects: ProjectInfo[]) { this.projects = projects }
  async getProject(projectId: string) { return this.mirrored.get(projectId) }
  async putProject(project: MirroredProject) { this.mirrored.set(project.projectId, project) }

  async listDocuments(projectId: string) { return this.inProject(this.documents, projectId) }
  async getDocument(projectId: string, id: string) { return this.documents.get(this.key(projectId, id)) }
  async putDocuments(documents: MirroredDocument[]) { for (const doc of documents) this.documents.set(this.key(doc.projectId, doc.id), doc) }
  async deleteDocument(projectId: string, id: string) { this.documents.delete(this.key(projectId, id)) }

  async listPending(projectId: string) { return this.inProject(this.pending, projectId) }
  async getPending(projectId: string, id: string) { return this.pending.get(this.key(projectId, id)) }
  async putPending(edit: PendingEdit) { this.pending.set(this.key(edit.projectId, edit.id), edit) }
  async deletePending(projectId: string, id: string) { this.pending.delete(this.key(projectId, id)) }

  async listOps(projectId: string) { return this.inProject(this.ops, projectId).sort((a, b) => a.seq! - b.seq!) }
  async putOp(op: PendingOp) { const stored = { ...op, seq: op.seq ?? this.nextSeq++ }; this.ops.set(stored.seq, stored); return stored }
  async deleteOp(seq: number) { this.ops.delete(seq) }

  async getVersions(projectId: string, id: string) { return this.versions.get(this.key(projectId, id)) }
  async putVersions(versions: CachedVersions) { this.versions.set(this.key(versions.projectId, versions.id), versions) }

  async getPlugins() { return this.plugins }
  async putPlugins(plugins: PluginInfo[]) { this.plugins = plugins }

  async replaceIds(projectId: string, ids: Record<string, string>) {
    const project = this.mirrored.get(projectId)
    if (project) { this.mirrored.delete(projectId); const moved = replaceIdsIn(project, ids); this.mirrored.set(moved.projectId, moved) }
    for (const [seq, op] of this.ops) if (op.projectId === projectId) this.ops.set(seq, replaceIdsIn(op, ids))
    const move = <T extends { projectId: string; id: string }>(map: Map<string, T>) => {
      for (const [key, row] of [...map]) {
        if (row.projectId !== projectId) continue
        const moved = replaceIdsIn(row, ids)
        map.delete(key)
        map.set(this.key(moved.projectId, moved.id), moved)
      }
    }
    move(this.documents); move(this.pending); move(this.versions)
  }
}
