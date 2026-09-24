import type { IMirrorStore } from './IMirrorStore'
import { DB_NAME, DB_VERSION, IndexedDbMirrorStore, upgrade } from './IndexedDbMirrorStore'
import { MemoryMirrorStore } from './MemoryMirrorStore'

export type * from './IMirrorStore'

export async function openMirrorStore(): Promise<IMirrorStore> {
  try {
    if (!('indexedDB' in globalThis)) return new MemoryMirrorStore()
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = () => upgrade(open.result)
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    void navigator.storage?.persist?.().catch(() => undefined)
    return new IndexedDbMirrorStore(db)
  } catch {
    return new MemoryMirrorStore()
  }
}
