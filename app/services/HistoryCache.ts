import type { IOdysseumApi } from '../api/IOdysseumApi'
import { isOffline } from '../api/IApiClient'
import type { Version } from '../models'
import type { IMirrorRepository } from '../storage'

/** The versions of a document, and the texts already read, so that history works offline for what was seen before. */
export class HistoryCache {
  constructor(private readonly api: IOdysseumApi, private readonly mirror: IMirrorRepository) {}

  async list(projectId: string, id: string): Promise<{ versions: Version[]; fresh: boolean }> {
    try {
      const versions = await this.api.listDocumentVersions(id)
      const cached = await this.mirror.getVersions(projectId, id)
      await this.mirror.putVersions({ projectId, id, list: versions, texts: cached?.texts ?? {} })
      return { versions, fresh: true }
    } catch (ex) {
      if (!isOffline(ex)) throw ex
      return { versions: (await this.mirror.getVersions(projectId, id))?.list ?? [], fresh: false }
    }
  }

  async read(projectId: string, id: string, versionId: string): Promise<string> {
    const cached = await this.mirror.getVersions(projectId, id)
    if (cached?.texts[versionId] !== undefined) return cached.texts[versionId]
    const text = await this.api.getDocumentVersionText(id, versionId)
    await this.mirror.putVersions({ projectId, id, list: cached?.list ?? [], texts: { ...cached?.texts, [versionId]: text } })
    return text
  }
}
