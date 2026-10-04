import type { PluginInfo, ProjectInfo } from '../models'
import { replaceIdsIn, type CachedVersions, type IMirrorRepository, type MirroredDocument, type MirroredProject, type PendingEdit, type PendingOp } from './IMirrorRepository'

export const DB_NAME = 'odysseum'
export const DB_VERSION = 3

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

const keyed = ['documents', 'pending', 'versions'] as const

/** Version 3 keys everything by project and item ID. The data of older versions used slugs and paths and is deleted. */
export function upgrade(db: IDBDatabase, oldVersion: number) {
  if (oldVersion < 3) for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name)
  const names = db.objectStoreNames
  if (!names.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
  if (!names.contains('projects')) db.createObjectStore('projects', { keyPath: 'projectId' })
  for (const name of keyed) if (!names.contains(name)) db.createObjectStore(name, { keyPath: ['projectId', 'id'] }).createIndex('projectId', 'projectId')
  if (!names.contains('ops')) db.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true }).createIndex('projectId', 'projectId')
}

export class IndexedDbMirrorRepository implements IMirrorRepository {
  readonly durable = true
  constructor(private readonly db: IDBDatabase) {}

  private read<T>(store: string, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return request(run(this.db.transaction(store, 'readonly').objectStore(store)))
  }

  private async write(stores: string | string[], run: (tx: IDBTransaction) => void): Promise<void> {
    const tx = this.db.transaction(stores, 'readwrite')
    run(tx)
    await complete(tx)
  }

  private byProject<T>(store: string, projectId: string) { return this.read<T[]>(store, s => s.index('projectId').getAll(projectId)) }
  private async meta<T>(key: string) { return (await this.read<{ key: string; value: T } | undefined>('meta', s => s.get(key)))?.value }
  private putMeta(key: string, value: unknown) { return this.write('meta', tx => tx.objectStore('meta').put({ key, value })) }

  async listProjects() { return await this.meta<ProjectInfo[]>('projects') ?? [] }
  putProjects(projects: ProjectInfo[]) { return this.putMeta('projects', projects) }
  getProject(projectId: string) { return this.read<MirroredProject | undefined>('projects', s => s.get(projectId)) }
  putProject(project: MirroredProject) { return this.write('projects', tx => tx.objectStore('projects').put(project)) }

  listDocuments(projectId: string) { return this.byProject<MirroredDocument>('documents', projectId) }
  getDocument(projectId: string, id: string) { return this.read<MirroredDocument | undefined>('documents', s => s.get([projectId, id])) }
  putDocuments(documents: MirroredDocument[]) {
    return documents.length ? this.write('documents', tx => { for (const doc of documents) tx.objectStore('documents').put(doc) }) : Promise.resolve()
  }
  deleteDocument(projectId: string, id: string) { return this.write('documents', tx => tx.objectStore('documents').delete([projectId, id])) }

  listPending(projectId: string) { return this.byProject<PendingEdit>('pending', projectId) }
  getPending(projectId: string, id: string) { return this.read<PendingEdit | undefined>('pending', s => s.get([projectId, id])) }
  putPending(edit: PendingEdit) { return this.write('pending', tx => tx.objectStore('pending').put(edit)) }
  deletePending(projectId: string, id: string) { return this.write('pending', tx => tx.objectStore('pending').delete([projectId, id])) }

  async listOps(projectId: string) {
    return (await this.byProject<PendingOp>('ops', projectId)).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  }
  async putOp(op: PendingOp) {
    const tx = this.db.transaction('ops', 'readwrite')
    const seq = await request(tx.objectStore('ops').put(op))
    await complete(tx)
    return { ...op, seq: seq as number }
  }
  deleteOp(seq: number) { return this.write('ops', tx => tx.objectStore('ops').delete(seq)) }

  getVersions(projectId: string, id: string) { return this.read<CachedVersions | undefined>('versions', s => s.get([projectId, id])) }
  putVersions(versions: CachedVersions) { return this.write('versions', tx => tx.objectStore('versions').put(versions)) }

  getPlugins() { return this.meta<PluginInfo[]>('plugins') }
  putPlugins(plugins: PluginInfo[]) { return this.putMeta('plugins', plugins) }

  async replaceIds(projectId: string, ids: Record<string, string>) {
    const [project, ops, ...rows] = await Promise.all([
      this.getProject(projectId), this.listOps(projectId), ...keyed.map(store => this.byProject<{ projectId: string; id: string }>(store, projectId)),
    ])
    await this.write(['projects', 'ops', ...keyed], tx => {
      if (project) { tx.objectStore('projects').delete(projectId); tx.objectStore('projects').put(replaceIdsIn(project, ids)) }
      for (const op of ops) tx.objectStore('ops').put(replaceIdsIn(op, ids))
      keyed.forEach((store, index) => {
        for (const row of rows[index]!) { tx.objectStore(store).delete([row.projectId, row.id]); tx.objectStore(store).put(replaceIdsIn(row, ids)) }
      })
    })
  }
}
