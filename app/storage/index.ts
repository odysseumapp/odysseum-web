import type { IMirrorRepository } from './IMirrorRepository'
import { DB_NAME, DB_VERSION, IndexedDbMirrorRepository, upgrade } from './IndexedDbMirrorRepository'
import { MemoryMirrorRepository } from './MemoryMirrorRepository'

export type * from './IMirrorRepository'
export { isLocalId, newLocalId } from './IMirrorRepository'

export async function openMirrorRepository(): Promise<IMirrorRepository> {
  try {
    if (!('indexedDB' in globalThis)) return new MemoryMirrorRepository()
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = event => upgrade(open.result, event.oldVersion)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    void navigator.storage?.persist?.().catch(() => undefined)
    return new IndexedDbMirrorRepository(db)
  } catch {
    return new MemoryMirrorRepository()
  }
}
